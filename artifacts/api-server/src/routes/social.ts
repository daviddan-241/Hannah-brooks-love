import { Router, type IRouter } from "express";
import { db, postsTable, settingsTable } from "@workspace/db";
import { adminAuth } from "../middleware/admin";
import { eq } from "drizzle-orm";
import { activityEmitter } from "../emitter";

const router: IRouter = Router();

let syncInterval: ReturnType<typeof setInterval> | null = null;
let syncConfig = {
  enabled: false,
  intervalHours: 6,
  xHandle: process.env.X_USERNAME || "",
  tiktokHandle: process.env.TIKTOK_USERNAME || "",
};

export async function loadSyncConfigFromDb(): Promise<void> {
  try {
    const rows = await db.select().from(settingsTable);
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    if (map["sync.enabled"] !== undefined) syncConfig.enabled = map["sync.enabled"] === "true";
    if (map["sync.intervalHours"] !== undefined) syncConfig.intervalHours = parseFloat(map["sync.intervalHours"]);
    if (map["sync.xHandle"] !== undefined) syncConfig.xHandle = map["sync.xHandle"];
    if (map["sync.tiktokHandle"] !== undefined) syncConfig.tiktokHandle = map["sync.tiktokHandle"];
    if (syncConfig.enabled) restartScheduler();
  } catch { /* ignore */ }
}

async function saveSyncConfig(): Promise<void> {
  const entries = [
    ["sync.enabled", String(syncConfig.enabled)],
    ["sync.intervalHours", String(syncConfig.intervalHours)],
    ["sync.xHandle", syncConfig.xHandle],
    ["sync.tiktokHandle", syncConfig.tiktokHandle],
  ];
  await Promise.all(entries.map(([key, value]) =>
    db.insert(settingsTable).values({ key, value })
      .onConflictDoUpdate({ target: settingsTable.key, set: { value, updatedAt: new Date() } })
  ));
}

// ── Free Twitter/X scraping via Nitter RSS ────────────────────────────────
const NITTER_INSTANCES = [
  "https://nitter.net",
  "https://nitter.privacydev.net",
  "https://nitter.poast.org",
  "https://nitter.1d4.us",
];

async function fetchNitterRss(handle: string): Promise<string | null> {
  const clean = handle.replace(/^@/, "").split("?")[0];
  for (const instance of NITTER_INSTANCES) {
    try {
      const res = await fetch(`${instance}/${clean}/rss`, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; RSS reader)" },
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const text = await res.text();
        if (text.includes("<item>")) return text;
      }
    } catch { /* try next */ }
  }
  return null;
}

function parseRssItems(xml: string): Array<{ id: string; text: string; imageUrl: string | null }> {
  const items: Array<{ id: string; text: string; imageUrl: string | null }> = [];
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
  for (const match of itemMatches) {
    const item = match[1];
    const linkMatch = item.match(/<link>(.*?)<\/link>/);
    const descMatch = item.match(/<description>([\s\S]*?)<\/description>/);
    if (!linkMatch) continue;
    const link = linkMatch[1];
    const idMatch = link.match(/\/status\/(\d+)/);
    const id = idMatch ? idMatch[1] : link;
    const descRaw = descMatch ? descMatch[1].replace(/<!\[CDATA\[|\]\]>/g, "") : "";
    const text = descRaw.replace(/<[^>]+>/g, "").trim().slice(0, 500);
    const imgMatch = item.match(/<enclosure[^>]+url="([^"]+)"/);
    const imgFromDesc = descRaw.match(/<img[^>]+src="([^"]+)"/);
    const imageUrl = imgMatch ? imgMatch[1] : imgFromDesc ? imgFromDesc[1] : null;
    if (id) items.push({ id, text, imageUrl });
  }
  return items;
}

async function syncX(handle: string): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = [];
  const clean = handle.replace(/^@/, "").replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, "").split("?")[0];

  // Try official API first if token is available
  const bearerToken = process.env.X_BEARER_TOKEN || "";
  if (bearerToken) {
    try {
      const userRes = await fetch(
        `https://api.twitter.com/2/users/by/username/${clean}?user.fields=id`,
        { headers: { Authorization: `Bearer ${bearerToken}` }, signal: AbortSignal.timeout(10000) }
      );
      if (userRes.ok) {
        const userData = await userRes.json() as { data?: { id: string } };
        const userId = userData.data?.id;
        if (userId) {
          const tweetsRes = await fetch(
            `https://api.twitter.com/2/users/${userId}/tweets?tweet.fields=attachments,created_at,text&expansions=attachments.media_keys&media.fields=url,preview_image_url,type&max_results=20&exclude=retweets,replies`,
            { headers: { Authorization: `Bearer ${bearerToken}` }, signal: AbortSignal.timeout(10000) }
          );
          if (tweetsRes.ok) {
            const tweetsData = await tweetsRes.json() as {
              data?: { id: string; text: string; attachments?: { media_keys?: string[] } }[];
              includes?: { media?: { media_key: string; url?: string; preview_image_url?: string; type: string }[] };
            };
            const mediaMap = new Map<string, string>();
            (tweetsData.includes?.media ?? []).forEach((m) => {
              const url = m.url ?? m.preview_image_url;
              if (url) mediaMap.set(m.media_key, url);
            });
            let synced = 0;
            for (const tweet of tweetsData.data ?? []) {
              const existing = await db.select().from(postsTable).where(eq(postsTable.externalId, tweet.id)).limit(1);
              if (existing[0]) continue;
              const imageUrl = tweet.attachments?.media_keys?.[0] ? mediaMap.get(tweet.attachments.media_keys[0]) ?? null : null;
              const [row] = await db.insert(postsTable).values({
                platform: "x",
                externalId: tweet.id,
                content: tweet.text,
                imageUrl: imageUrl || "https://pbs.twimg.com/profile_images/default.png",
                isPrivate: false,
                publishedAt: new Date(),
              }).returning();
              activityEmitter.emit("activity", {
                type: "new_post",
                post: { ...row, createdAt: row.createdAt.toISOString() } as Record<string, unknown>,
                timestamp: new Date().toISOString(),
              });
              synced++;
            }
            if (synced > 0) {
              activityEmitter.emit("activity", { type: "sync_complete", platform: "x", synced, timestamp: new Date().toISOString() });
            }
            return { synced, errors };
          }
        }
      }
    } catch { /* fall through to free scraping */ }
  }

  // Free fallback: Nitter RSS
  const rss = await fetchNitterRss(clean);
  if (!rss) {
    errors.push("X: Could not reach any Nitter instance for free scraping. Add X_BEARER_TOKEN in Settings for reliable sync.");
    return { synced: 0, errors };
  }
  const items = parseRssItems(rss);
  let synced = 0;
  for (const item of items) {
    const existing = await db.select().from(postsTable).where(eq(postsTable.externalId, item.id)).limit(1);
    if (existing[0]) continue;
    const [row] = await db.insert(postsTable).values({
      platform: "x",
      externalId: item.id,
      content: item.text,
      imageUrl: item.imageUrl || "https://pbs.twimg.com/profile_images/default.png",
      isPrivate: false,
      publishedAt: new Date(),
    }).returning();
    activityEmitter.emit("activity", {
      type: "new_post",
      post: { ...row, createdAt: row.createdAt.toISOString() } as Record<string, unknown>,
      timestamp: new Date().toISOString(),
    });
    synced++;
  }
  if (synced > 0) {
    activityEmitter.emit("activity", { type: "sync_complete", platform: "x", synced, timestamp: new Date().toISOString() });
  }
  return { synced, errors };
}

// ── Free TikTok scraping via tikwm.com ────────────────────────────────────
async function syncTikTok(handle: string): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = [];
  const cleanHandle = handle.replace(/^@/, "").split("?")[0];

  // Try paid RapidAPI first if key is set
  const rapidKey = process.env.RAPIDAPI_KEY || "";
  if (rapidKey) {
    try {
      const res = await fetch(
        `https://tiktok-scraper7.p.rapidapi.com/user/posts?unique_id=${encodeURIComponent(cleanHandle)}&count=20`,
        {
          headers: { "X-RapidAPI-Key": rapidKey, "X-RapidAPI-Host": "tiktok-scraper7.p.rapidapi.com" },
          signal: AbortSignal.timeout(10000),
        }
      );
      if (res.ok) {
        const data = await res.json() as {
          data?: { videos?: { video_id: string; title: string; cover: string; play: string }[] };
        };
        if (data.data?.videos?.length) {
          let synced = 0;
          for (const video of data.data.videos) {
            const existing = await db.select().from(postsTable).where(eq(postsTable.externalId, video.video_id)).limit(1);
            if (existing[0]) continue;
            const [row] = await db.insert(postsTable).values({
              platform: "tiktok",
              externalId: video.video_id,
              content: video.title,
              imageUrl: video.cover,
              videoUrl: video.play,
              isPrivate: false,
              publishedAt: new Date(),
            }).returning();
            activityEmitter.emit("activity", {
              type: "new_post",
              post: { ...row, createdAt: row.createdAt.toISOString() } as Record<string, unknown>,
              timestamp: new Date().toISOString(),
            });
            synced++;
          }
          if (synced > 0) {
            activityEmitter.emit("activity", { type: "sync_complete", platform: "tiktok", synced, timestamp: new Date().toISOString() });
          }
          return { synced, errors };
        }
      }
    } catch { /* fall through */ }
  }

  // Free fallback: tikwm.com public API (no key required)
  try {
    const userRes = await fetch(
      `https://www.tikwm.com/api/user/info?unique_id=${encodeURIComponent(cleanHandle)}`,
      {
        headers: { "User-Agent": "Mozilla/5.0", "Content-Type": "application/json" },
        signal: AbortSignal.timeout(12000),
      }
    );
    if (!userRes.ok) throw new Error(`tikwm user info failed: ${userRes.status}`);
    const userData = await userRes.json() as { data?: { user?: { sec_uid?: string; uid?: string } } };
    const secUid = userData.data?.user?.sec_uid;
    if (!secUid) throw new Error("Could not get TikTok user sec_uid");

    const postsRes = await fetch(
      `https://www.tikwm.com/api/user/posts?unique_id=${encodeURIComponent(cleanHandle)}&count=20&cursor=0`,
      {
        headers: { "User-Agent": "Mozilla/5.0", "Content-Type": "application/json" },
        signal: AbortSignal.timeout(12000),
      }
    );
    if (!postsRes.ok) throw new Error(`tikwm posts failed: ${postsRes.status}`);
    const postsData = await postsRes.json() as {
      data?: {
        videos?: Array<{
          video_id: string; id?: string; title?: string; desc?: string;
          cover?: string; origin_cover?: string;
          play?: string; wmplay?: string;
        }>;
      };
    };

    let synced = 0;
    for (const video of postsData.data?.videos ?? []) {
      const vid = video.video_id || video.id || "";
      if (!vid) continue;
      const existing = await db.select().from(postsTable).where(eq(postsTable.externalId, vid)).limit(1);
      if (existing[0]) continue;
      const cover = video.origin_cover || video.cover || "";
      const playUrl = video.play || video.wmplay || "";
      const caption = video.title || video.desc || "";
      const [row] = await db.insert(postsTable).values({
        platform: "tiktok",
        externalId: vid,
        content: caption,
        imageUrl: cover,
        videoUrl: playUrl || undefined,
        mediaType: playUrl ? "video" : "image",
        isPrivate: false,
        publishedAt: new Date(),
      }).returning();
      activityEmitter.emit("activity", {
        type: "new_post",
        post: { ...row, createdAt: row.createdAt.toISOString() } as Record<string, unknown>,
        timestamp: new Date().toISOString(),
      });
      synced++;
    }
    if (synced > 0) {
      activityEmitter.emit("activity", { type: "sync_complete", platform: "tiktok", synced, timestamp: new Date().toISOString() });
    }
    return { synced, errors };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(`TikTok free scraping failed: ${msg}. Add RAPIDAPI_KEY in Settings for a more reliable feed.`);
    return { synced: 0, errors };
  }
}

// ── Instagram sync (Graph API) ────────────────────────────────────────────
async function syncInstagram(accessToken: string, userId: string): Promise<{ synced: number; errors: string[] }> {
  const errors: string[] = [];
  try {
    const mediaRes = await fetch(
      `https://graph.instagram.com/v18.0/${userId}/media?fields=id,caption,media_type,media_url,thumbnail_url,timestamp,permalink&limit=20&access_token=${accessToken}`,
      { signal: AbortSignal.timeout(10000) }
    );
    if (!mediaRes.ok) { errors.push(`Instagram media fetch failed: ${await mediaRes.text()}`); return { synced: 0, errors }; }
    const mediaData = await mediaRes.json() as { data?: { id: string; caption?: string; media_type: string; media_url?: string; thumbnail_url?: string; timestamp: string; permalink: string }[] };
    if (!mediaData.data?.length) return { synced: 0, errors };

    let synced = 0;
    for (const item of mediaData.data) {
      if (item.media_type === "VIDEO" && !item.thumbnail_url) continue;
      const imageUrl = item.media_url || item.thumbnail_url || "";
      if (!imageUrl) continue;
      const existing = await db.query.postsTable.findFirst({ where: (p, { eq }) => eq(p.imageUrl, imageUrl) });
      if (existing) continue;
      const [row] = await db.insert(postsTable).values({
        imageUrl,
        caption: item.caption || null,
        platform: "instagram",
        isPrivate: false,
        watermark: false,
        publishedAt: new Date(item.timestamp),
      }).returning();
      activityEmitter.emit("activity", {
        type: "new_post",
        post: { ...row, createdAt: row.createdAt.toISOString() } as Record<string, unknown>,
        timestamp: new Date().toISOString(),
      });
      synced++;
    }
    if (synced > 0) {
      activityEmitter.emit("activity", { type: "sync_complete", platform: "instagram", synced, timestamp: new Date().toISOString() });
    }
    return { synced, errors };
  } catch (e: unknown) { errors.push(e instanceof Error ? e.message : String(e)); return { synced: 0, errors }; }
}

async function runAllSyncs() {
  const results: Record<string, unknown> = {};
  if (syncConfig.xHandle) results.x = await syncX(syncConfig.xHandle);
  if (syncConfig.tiktokHandle) results.tiktok = await syncTikTok(syncConfig.tiktokHandle);
  return results;
}

function restartScheduler() {
  if (syncInterval) clearInterval(syncInterval);
  syncInterval = null;
  if (!syncConfig.enabled) return;
  const ms = syncConfig.intervalHours * 60 * 60 * 1000;
  runAllSyncs().catch(() => {});
  syncInterval = setInterval(runAllSyncs, ms);
}

router.get("/social/sync/config", adminAuth, (_req, res) => {
  res.json(syncConfig);
});

router.patch("/social/sync/config", adminAuth, async (req, res) => {
  const body = req.body as Partial<typeof syncConfig>;
  syncConfig = { ...syncConfig, ...body };
  restartScheduler();
  await saveSyncConfig().catch(() => {});
  res.json(syncConfig);
});

router.post("/social/sync/x", adminAuth, async (req, res): Promise<void> => {
  const { handle } = req.body as { handle?: string };
  if (!handle) { res.status(400).json({ error: "handle required" }); return; }
  try {
    syncConfig.xHandle = handle;
    await saveSyncConfig().catch(() => {});
    const result = await syncX(handle);
    res.json(result);
  } catch (e: unknown) {
    res.status(500).json({ error: `Sync failed: ${e instanceof Error ? e.message : String(e)}` });
  }
});

router.post("/social/sync/tiktok", adminAuth, async (req, res): Promise<void> => {
  const { handle } = req.body as { handle?: string };
  if (!handle) { res.status(400).json({ error: "handle required" }); return; }
  try {
    syncConfig.tiktokHandle = handle;
    await saveSyncConfig().catch(() => {});
    const result = await syncTikTok(handle);
    res.json(result);
  } catch (e: unknown) {
    res.status(500).json({ error: `Sync failed: ${e instanceof Error ? e.message : String(e)}` });
  }
});

router.post("/social/sync/all", adminAuth, async (_req, res): Promise<void> => {
  try {
    const result = await runAllSyncs();
    res.json(result);
  } catch (e: unknown) {
    res.status(500).json({ error: `Sync failed: ${e instanceof Error ? e.message : String(e)}` });
  }
});

router.post("/social/sync/instagram", adminAuth, async (req, res): Promise<void> => {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN || (req.body as { token?: string }).token || "";
  const userId = process.env.INSTAGRAM_USER_ID || (req.body as { userId?: string }).userId || "";
  if (!token) { res.status(400).json({ error: "INSTAGRAM_ACCESS_TOKEN not set. Add it in Settings → API Keys." }); return; }
  if (!userId) { res.status(400).json({ error: "INSTAGRAM_USER_ID not set. Find it at graph.instagram.com/me?access_token=YOUR_TOKEN" }); return; }
  try {
    const result = await syncInstagram(token, userId);
    res.json(result);
  } catch (e: unknown) { res.status(500).json({ error: `Instagram sync failed: ${e instanceof Error ? e.message : String(e)}` }); }
});

router.post("/social/github/push", adminAuth, async (req, res): Promise<void> => {
  const { exec } = await import("child_process");
  const { promisify } = await import("util");
  const execAsync = promisify(exec);

  const target = (req.body && (req.body as { target?: string }).target) || "public";
  const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN || "";

  if (!token) {
    res.status(400).json({ error: "GITHUB_PERSONAL_ACCESS_TOKEN not set. Add it in Replit Secrets." });
    return;
  }

  const repoMap: Record<string, string> = {
    public: `https://${token}@github.com/daviddan-241/Hannah-brooks-love.git`,
    admin:  `https://${token}@github.com/daviddan-241/Admin.git`,
  };

  const remote = repoMap[target];
  if (!remote) {
    res.status(400).json({ error: `Unknown target "${target}". Use "public" or "admin".` });
    return;
  }

  try {
    await execAsync("git add -A");
    const timestamp = new Date().toISOString();
    await execAsync(`git -c user.email="admin@hannahbrooks.com" -c user.name="Hannah Brooks Admin" commit -m "Auto-sync [${target}] ${timestamp}" --allow-empty`);
    const isShallow = await execAsync("git rev-parse --is-shallow-repository").then(r => r.stdout.trim() === "true").catch(() => false);
    if (isShallow) await execAsync("git fetch --unshallow").catch(() => null);
    const { stdout, stderr } = await execAsync(`git push "${remote}" HEAD:main --force --no-thin`);
    res.json({ success: true, target, stdout, stderr, timestamp });
  } catch (e: unknown) {
    const err = e instanceof Error ? e.message : String(e);
    res.status(500).json({ error: `Git push failed: ${err}`, stdout: (e as NodeJS.ErrnoException & { stdout?: string }).stdout, stderr: (e as NodeJS.ErrnoException & { stderr?: string }).stderr });
  }
});

export default router;

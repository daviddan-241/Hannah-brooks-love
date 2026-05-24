import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, postsTable } from "@workspace/db";
import { adminAuth } from "../middleware/admin";
import { activityEmitter } from "../emitter";
import { sendPush } from "../lib/push";

const router: IRouter = Router();

const PLATFORMS = ["instagram", "twitter", "tiktok", "x", "custom"] as const;

function isValidUrl(url: string) {
  return url.startsWith("http://") || url.startsWith("https://") || url.startsWith("/uploads/");
}

function validatePost(body: Record<string, unknown>): {
  imageUrl: string; videoUrl?: string; thumbnailUrl?: string; mediaType: string;
  caption?: string; platform: string; isPrivate: boolean; watermark: boolean;
} | null {
  const { imageUrl, videoUrl, thumbnailUrl, caption, platform, isPrivate, watermark } = body;

  const hasImage = typeof imageUrl === "string" && isValidUrl(imageUrl);
  const hasVideo = typeof videoUrl === "string" && isValidUrl(videoUrl);

  if (!hasImage && !hasVideo) return null;

  const mediaType = hasVideo ? "video" : "image";
  const resolvedImageUrl = hasImage ? (imageUrl as string) : (thumbnailUrl as string) || "/uploads/posts/default-thumb.png";

  const p = typeof platform === "string" && PLATFORMS.includes(platform as typeof PLATFORMS[number]) ? platform : "custom";

  return {
    imageUrl: resolvedImageUrl,
    videoUrl: hasVideo ? (videoUrl as string) : undefined,
    thumbnailUrl: typeof thumbnailUrl === "string" ? (thumbnailUrl as string) : undefined,
    mediaType,
    caption: typeof caption === "string" ? caption : undefined,
    platform: p,
    isPrivate: isPrivate === true,
    watermark: watermark !== false,
  };
}

router.get("/posts", async (_req, res): Promise<void> => {
  const rows = await db.select().from(postsTable).orderBy(desc(postsTable.createdAt));
  res.json(rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

router.post("/posts", adminAuth, async (req, res): Promise<void> => {
  const data = validatePost(req.body as Record<string, unknown>);
  if (!data) {
    res.status(400).json({ error: "Invalid post data. imageUrl or videoUrl must be a valid URL." });
    return;
  }
  const [row] = await db.insert(postsTable).values(data).returning();
  const post = { ...row, createdAt: row.createdAt.toISOString() };

  activityEmitter.emit("activity", {
    type: "new_post",
    post: post as Record<string, unknown>,
    timestamp: new Date().toISOString(),
  });

  sendPush("📸 New Post Published", `${row.caption?.slice(0, 80) || row.mediaType + " post"} · ${row.isPrivate ? "VIP only" : "Public"}`, { tag: "post", url: "/admin" }).catch(() => {});

  res.status(201).json(post);
});

router.delete("/posts/:id", adminAuth, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(postsTable).where(eq(postsTable.id, id));

  activityEmitter.emit("activity", {
    type: "delete_post",
    postId: id,
    timestamp: new Date().toISOString(),
  });

  res.status(204).send();
});

export default router;

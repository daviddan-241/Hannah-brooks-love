import { Router, type IRouter } from "express";
import { eq, desc, gt, and } from "drizzle-orm";
import { db, chatSessionsTable, chatMessagesTable } from "@workspace/db";
import { adminAuth } from "../middleware/admin";
import { activityEmitter } from "../emitter";
import { sendMail, emailAdminNewChat, emailAdminFanMessage } from "../lib/mailer";
import { sendPush } from "../lib/push";
import { platformConfig } from "./settings";
import multer from "multer";
import path from "path";
import fs from "fs";

const router: IRouter = Router();
const FREE_LIMIT = 5;

// ── File upload setup ──────────────────────────────────────────────────────
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });

function serializeSession(s: typeof chatSessionsTable.$inferSelect) {
  return {
    ...s,
    lastMessageAt: s.lastMessageAt?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
  };
}
function serializeMsg(m: typeof chatMessagesTable.$inferSelect) {
  return { ...m, amountPaid: Number(m.amountPaid), createdAt: m.createdAt.toISOString() };
}

// POST /chat/start — create or resume a session
router.post("/chat/start", async (req, res): Promise<void> => {
  const { email, name, avatarUrl } = req.body as { email?: string; name?: string; avatarUrl?: string };
  if (!email || !name) { res.status(400).json({ error: "email and name required" }); return; }

  const existing = await db.select().from(chatSessionsTable).where(eq(chatSessionsTable.fanEmail, email.toLowerCase())).limit(1);
  if (existing[0]) {
    if (avatarUrl && !existing[0].fanAvatarUrl) {
      await db.update(chatSessionsTable).set({ fanAvatarUrl: avatarUrl }).where(eq(chatSessionsTable.id, existing[0].id));
    }
    const updated = await db.select().from(chatSessionsTable).where(eq(chatSessionsTable.id, existing[0].id)).limit(1);
    const msgs = await db.select().from(chatMessagesTable).where(eq(chatMessagesTable.sessionId, existing[0].id)).orderBy(chatMessagesTable.createdAt);
    res.json({ session: serializeSession(updated[0]), messages: msgs.map(serializeMsg), freeLimit: FREE_LIMIT });
    return;
  }

  const [session] = await db.insert(chatSessionsTable).values({
    fanEmail: email.toLowerCase(),
    fanName: name,
    fanAvatarUrl: avatarUrl ?? null,
  }).returning();

  const adminEmail = (platformConfig as any).adminEmail;
  if (adminEmail) {
    const tpl = emailAdminNewChat({ fanName: name, fanEmail: email });
    sendMail({ to: adminEmail, subject: tpl.subject, html: tpl.html }).catch(() => {});
  }

  sendPush(`💬 New Fan Chat — ${name}`, `${email} just started a chat`, { tag: "chat", url: "/admin" }).catch(() => {});

  res.status(201).json({ session: serializeSession(session), messages: [], freeLimit: FREE_LIMIT });
});

// GET /chat/:token — get session + messages
router.get("/chat/:token", async (req, res): Promise<void> => {
  const [session] = await db.select().from(chatSessionsTable).where(eq(chatSessionsTable.fanToken, req.params.token)).limit(1);
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }
  const msgs = await db.select().from(chatMessagesTable).where(eq(chatMessagesTable.sessionId, session.id)).orderBy(chatMessagesTable.createdAt);
  res.json({ session: serializeSession(session), messages: msgs.map(serializeMsg), freeLimit: FREE_LIMIT });
});

// GET /chat/:token/poll?since=ISO — poll for new messages
router.get("/chat/:token/poll", async (req, res): Promise<void> => {
  const [session] = await db.select().from(chatSessionsTable).where(eq(chatSessionsTable.fanToken, req.params.token)).limit(1);
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }
  const since = req.query.since ? new Date(req.query.since as string) : new Date(0);
  const msgs = await db.select().from(chatMessagesTable).where(
    and(eq(chatMessagesTable.sessionId, session.id), gt(chatMessagesTable.createdAt, since))
  ).orderBy(chatMessagesTable.createdAt);
  res.json({ messages: msgs.map(serializeMsg), freeUsed: session.freeUsed });
});

// GET /chat/:token/stream — SSE real-time messages (replaces polling)
router.get("/chat/:token/stream", async (req, res): Promise<void> => {
  const [session] = await db.select().from(chatSessionsTable).where(eq(chatSessionsTable.fanToken, req.params.token)).limit(1);
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  res.write(":ok\n\n");

  let lastMsgId = 0;

  const poll = setInterval(async () => {
    try {
      const [freshSession] = await db.select().from(chatSessionsTable)
        .where(eq(chatSessionsTable.id, session.id)).limit(1);
      const msgs = await db.select().from(chatMessagesTable).where(
        and(eq(chatMessagesTable.sessionId, session.id), gt(chatMessagesTable.id, lastMsgId))
      ).orderBy(chatMessagesTable.createdAt);

      if (msgs.length > 0) {
        lastMsgId = msgs[msgs.length - 1].id;
        res.write(`data: ${JSON.stringify({
          type: "messages",
          messages: msgs.map(serializeMsg),
          freeUsed: freshSession?.freeUsed ?? session.freeUsed,
        })}\n\n`);
      } else {
        res.write(":ping\n\n");
      }
    } catch { /* ignore db errors during stream */ }
  }, 1500);

  req.on("close", () => clearInterval(poll));
});

// POST /chat/:token/send — fan sends message (text)
router.post("/chat/:token/send", async (req, res): Promise<void> => {
  const [session] = await db.select().from(chatSessionsTable).where(eq(chatSessionsTable.fanToken, req.params.token)).limit(1);
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  const { message, txRef, amountPaid } = req.body as { message?: string; txRef?: string; amountPaid?: number };
  if (!message?.trim()) { res.status(400).json({ error: "Message required" }); return; }

  const isFree = session.freeUsed < FREE_LIMIT;
  if (!isFree && (!txRef || !amountPaid)) {
    res.status(402).json({ error: "Payment required", freeUsed: session.freeUsed, freeLimit: FREE_LIMIT });
    return;
  }

  const paid = isFree ? 0 : (amountPaid ?? 0);

  const [msg] = await db.insert(chatMessagesTable).values({
    sessionId: session.id,
    senderType: "fan",
    message: message.trim(),
    amountPaid: String(paid),
    txRef: txRef ?? null,
    isRead: false,
  }).returning();

  await db.update(chatSessionsTable).set({
    freeUsed: isFree ? session.freeUsed + 1 : session.freeUsed,
    lastMessageAt: new Date(),
  }).where(eq(chatSessionsTable.id, session.id));

  const adminEmail = (platformConfig as any).adminEmail;
  if (adminEmail) {
    const tpl = emailAdminFanMessage({
      fanName: session.fanName,
      fanEmail: session.fanEmail,
      message: message.trim(),
      paid: !isFree && paid > 0,
      amount: !isFree && paid > 0 ? String(paid) : undefined,
    });
    sendMail({ to: adminEmail, subject: tpl.subject, html: tpl.html }).catch(() => {});
  }

  const pushTitle = !isFree && paid > 0
    ? `💰 Paid Message — ${session.fanName}`
    : `💬 Message — ${session.fanName}`;
  sendPush(pushTitle, message.trim().slice(0, 100), { tag: `msg-${session.id}`, url: "/admin" }).catch(() => {});

  if (!isFree && paid > 0) {
    activityEmitter.emit("activity", {
      type: "message",
      fanName: session.fanName,
      amount: paid,
      detail: `Paid message from ${session.fanName}: "${message.slice(0, 40)}…"`,
      timestamp: new Date().toISOString(),
    });
  }

  res.status(201).json(serializeMsg(msg));
});

// POST /chat/:token/upload — fan uploads voice note or file
router.post("/chat/:token/upload", upload.single("file"), async (req, res): Promise<void> => {
  const [session] = await db.select().from(chatSessionsTable).where(eq(chatSessionsTable.fanToken, req.params.token)).limit(1);
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }

  const { txRef, amountPaid, msgType } = req.body as { txRef?: string; amountPaid?: string; msgType?: string };
  const isFree = session.freeUsed < FREE_LIMIT;
  if (!isFree && (!txRef || !amountPaid)) {
    res.status(402).json({ error: "Payment required" });
    return;
  }

  const paid = isFree ? 0 : parseFloat(amountPaid ?? "0");
  const fileUrl = `/uploads/${req.file.filename}`;
  const type = msgType || (req.file.mimetype.startsWith("audio") ? "voice" : req.file.mimetype.startsWith("image") ? "image" : "file");
  const encodedMsg = JSON.stringify({ type, url: fileUrl, name: req.file.originalname, size: req.file.size, mime: req.file.mimetype });

  const [msg] = await db.insert(chatMessagesTable).values({
    sessionId: session.id,
    senderType: "fan",
    message: `[ATTACHMENT]${encodedMsg}`,
    amountPaid: String(paid),
    txRef: txRef ?? null,
    isRead: false,
  }).returning();

  await db.update(chatSessionsTable).set({
    freeUsed: isFree ? session.freeUsed + 1 : session.freeUsed,
    lastMessageAt: new Date(),
  }).where(eq(chatSessionsTable.id, session.id));

  res.status(201).json(serializeMsg(msg));
});

// POST /chat/:token/avatar — fan uploads avatar
router.post("/chat/:token/avatar", upload.single("avatar"), async (req, res): Promise<void> => {
  const [session] = await db.select().from(chatSessionsTable).where(eq(chatSessionsTable.fanToken, req.params.token)).limit(1);
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }
  if (!req.file) { res.status(400).json({ error: "No file" }); return; }

  const avatarUrl = `/uploads/${req.file.filename}`;
  await db.update(chatSessionsTable).set({ fanAvatarUrl: avatarUrl }).where(eq(chatSessionsTable.id, session.id));
  res.json({ avatarUrl });
});

// GET /chat/admin/sessions — all sessions (admin only)
router.get("/chat/admin/sessions", adminAuth, async (_req, res): Promise<void> => {
  const sessions = await db.select().from(chatSessionsTable).orderBy(desc(chatSessionsTable.lastMessageAt));
  const result = await Promise.all(sessions.map(async (s) => {
    const msgs = await db.select().from(chatMessagesTable).where(eq(chatMessagesTable.sessionId, s.id)).orderBy(desc(chatMessagesTable.createdAt)).limit(1);
    const unread = await db.select().from(chatMessagesTable).where(
      and(eq(chatMessagesTable.sessionId, s.id), eq(chatMessagesTable.senderType, "fan"), eq(chatMessagesTable.isRead, false))
    );
    return { ...serializeSession(s), lastMessage: msgs[0] ? serializeMsg(msgs[0]) : null, unreadCount: unread.length };
  }));
  res.json(result);
});

// GET /chat/admin/:sessionId/messages — get all messages for a session (admin)
router.get("/chat/admin/:sessionId/messages", adminAuth, async (req, res): Promise<void> => {
  const sessionId = parseInt(req.params.sessionId, 10);
  const [session] = await db.select().from(chatSessionsTable).where(eq(chatSessionsTable.id, sessionId)).limit(1);
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }
  const msgs = await db.select().from(chatMessagesTable).where(eq(chatMessagesTable.sessionId, sessionId)).orderBy(chatMessagesTable.createdAt);
  await db.update(chatMessagesTable).set({ isRead: true }).where(
    and(eq(chatMessagesTable.sessionId, sessionId), eq(chatMessagesTable.senderType, "fan"))
  );
  res.json({ session: serializeSession(session), messages: msgs.map(serializeMsg) });
});

// POST /chat/admin/:sessionId/reply — Hannah replies (admin only)
router.post("/chat/admin/:sessionId/reply", adminAuth, async (req, res): Promise<void> => {
  const sessionId = parseInt(req.params.sessionId, 10);
  const { message } = req.body as { message?: string };
  if (!message?.trim()) { res.status(400).json({ error: "Message required" }); return; }

  const [session] = await db.select().from(chatSessionsTable).where(eq(chatSessionsTable.id, sessionId)).limit(1);
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  const [msg] = await db.insert(chatMessagesTable).values({
    sessionId,
    senderType: "hannah",
    message: message.trim(),
    amountPaid: "0",
    isRead: true,
  }).returning();

  await db.update(chatSessionsTable).set({ lastMessageAt: new Date() }).where(eq(chatSessionsTable.id, sessionId));

  activityEmitter.emit("activity", {
    type: "message",
    fanName: session.fanName,
    amount: 0,
    detail: `Hannah replied to ${session.fanName}`,
    timestamp: new Date().toISOString(),
  });

  res.status(201).json(serializeMsg(msg));
});

// POST /chat/admin/:sessionId/ai-suggest — generate an AI suggested reply
router.post("/chat/admin/:sessionId/ai-suggest", adminAuth, async (req, res): Promise<void> => {
  const sessionId = parseInt(req.params.sessionId, 10);
  const [session] = await db.select().from(chatSessionsTable).where(eq(chatSessionsTable.id, sessionId)).limit(1);
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }

  const msgs = await db.select().from(chatMessagesTable)
    .where(eq(chatMessagesTable.sessionId, sessionId))
    .orderBy(desc(chatMessagesTable.createdAt))
    .limit(10);

  const fanMessages = msgs.filter(m => m.senderType === "fan").reverse();
  const lastFanMsg = fanMessages[fanMessages.length - 1];

  if (!lastFanMsg) {
    res.json({ suggestion: `Hi ${session.fanName}! 💕 So lovely to have you here darling. How can I make your day extra special? ✨` });
    return;
  }

  const txt = lastFanMsg.message.toLowerCase();
  let suggestion = "";

  if (txt.includes("custom") || txt.includes("request") || txt.includes("commission")) {
    suggestion = `Of course darling! 😍 I'd love to create something special just for you. Head to my Requests page and fill in the details — I read every single one personally! 💕`;
  } else if (txt.includes("call") || txt.includes("zoom") || txt.includes("whatsapp") || txt.includes("facetime") || txt.includes("video chat")) {
    suggestion = `Ooh a personal call — how exciting! 💖 I have several options on my Calls page starting from just $29.99. I'd love to spend some one-on-one time with you ${session.fanName}! ✨`;
  } else if (txt.includes("vip") || txt.includes("subscribe") || txt.includes("membership") || txt.includes("exclusive") || txt.includes("unlock")) {
    suggestion = `My VIP Members section is where all the really exclusive content lives 🔥 Monthly, quarterly, or lifetime options are available — grab lifetime for the best value darling! 💋`;
  } else if (txt.includes("onlyfans") || txt.includes("only fans")) {
    suggestion = `I have everything right here in my Members section — it's much more personal than OnlyFans! 😘 You can subscribe and get instant access to all my exclusive content 💕`;
  } else if (txt.includes("tip") || txt.includes("send money") || txt.includes("gift") || txt.includes("support")) {
    suggestion = `Aww you are so incredibly sweet ${session.fanName}! 🥹 You can send me a tip from the Boutique page — it truly means the world to me darling 💝`;
  } else if (txt.includes("love") || txt.includes("miss") || txt.includes("beautiful") || txt.includes("gorgeous") || txt.includes("pretty")) {
    suggestion = `You're making me blush ${session.fanName}! 🥰 That is so incredibly sweet of you darling. You always know how to brighten my day 💕✨`;
  } else if (txt.includes("content") || txt.includes("photo") || txt.includes("picture") || txt.includes("video")) {
    suggestion = `I post new content regularly darling — check my Feed for the latest! 📸 And VIP members get access to everything that's a little more exclusive 😘💕`;
  } else if (txt.includes("when") || txt.includes("next") || txt.includes("new")) {
    suggestion = `I'm always creating new things just for my fans! 💫 Make sure you're a VIP member so you never miss any of my exclusive content ${session.fanName} 💕`;
  } else if (txt.includes("thank") || txt.includes("thanks")) {
    suggestion = `Of course darling! 💕 You are one of my favourite fans and I truly appreciate your support so much! You make all of this worthwhile ✨`;
  } else {
    const firstName = session.fanName.split(" ")[0];
    suggestion = `Hi ${firstName}! 💕 So lovely hearing from you darling! How can I make your day a little more special today? ✨ I'm all yours 😘`;
  }

  res.json({ suggestion });
});

// POST /chat/admin/:sessionId/reply-media — Hannah sends voice/image reply
router.post("/chat/admin/:sessionId/reply-media", adminAuth, upload.single("file"), async (req, res): Promise<void> => {
  const sessionId = parseInt(req.params.sessionId, 10);
  const [session] = await db.select().from(chatSessionsTable).where(eq(chatSessionsTable.id, sessionId)).limit(1);
  if (!session) { res.status(404).json({ error: "Session not found" }); return; }
  if (!req.file) { res.status(400).json({ error: "No file" }); return; }

  const fileUrl = `/uploads/${req.file.filename}`;
  const type = req.file.mimetype.startsWith("audio") ? "voice" : req.file.mimetype.startsWith("image") ? "image" : "file";
  const encodedMsg = JSON.stringify({ type, url: fileUrl, name: req.file.originalname, size: req.file.size, mime: req.file.mimetype });

  const [msg] = await db.insert(chatMessagesTable).values({
    sessionId,
    senderType: "hannah",
    message: `[ATTACHMENT]${encodedMsg}`,
    amountPaid: "0",
    isRead: true,
  }).returning();

  await db.update(chatSessionsTable).set({ lastMessageAt: new Date() }).where(eq(chatSessionsTable.id, sessionId));
  res.status(201).json(serializeMsg(msg));
});

export default router;

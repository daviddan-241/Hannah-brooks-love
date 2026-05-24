import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { db, tipsTable } from "@workspace/db";
import { CreateTipBody } from "@workspace/api-zod";
import { activityEmitter } from "../emitter";
import { sendMail, emailFanTipReceived, emailAdminNewTip } from "../lib/mailer";
import { sendPush } from "../lib/push";
import { platformConfig } from "./settings";

const router: IRouter = Router();

router.get("/tips", async (_req, res): Promise<void> => {
  const rows = await db.select().from(tipsTable).orderBy(desc(tipsTable.createdAt));
  res.json(rows.map((r) => ({
    ...r,
    amount: Number(r.amount),
    createdAt: r.createdAt.toISOString(),
  })));
});

router.post("/tips", async (req, res): Promise<void> => {
  const parsed = CreateTipBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(tipsTable).values({
    fanEmail: parsed.data.fanEmail,
    fanName: parsed.data.fanName,
    amount: String(parsed.data.amount),
    txRef: parsed.data.txRef,
    message: parsed.data.message ?? null,
  }).returning();

  activityEmitter.emit("activity", {
    type: "tip",
    fanName: parsed.data.fanName,
    amount: parsed.data.amount,
    detail: `Tip of $${parsed.data.amount} from ${parsed.data.fanName}`,
    timestamp: new Date().toISOString(),
  });

  // Email fan thank-you
  const fanTpl = emailFanTipReceived({
    name: parsed.data.fanName,
    amount: String(parsed.data.amount),
    message: parsed.data.message ?? undefined,
  });
  sendMail({ to: parsed.data.fanEmail, subject: fanTpl.subject, html: fanTpl.html }).catch(() => {});

  // Email admin notification
  const adminEmail = (platformConfig as any).adminEmail;
  if (adminEmail) {
    const adminTpl = emailAdminNewTip({
      fanName: parsed.data.fanName,
      fanEmail: parsed.data.fanEmail,
      amount: String(parsed.data.amount),
      message: parsed.data.message ?? undefined,
    });
    sendMail({ to: adminEmail, subject: adminTpl.subject, html: adminTpl.html }).catch(() => {});
  }

  sendPush(`💝 New Tip — ${parsed.data.fanName}`, `$${parsed.data.amount}${parsed.data.message ? ` · "${parsed.data.message.slice(0, 60)}"` : ""}`, { tag: "tip", url: "/admin" }).catch(() => {});

  res.status(201).json({ ...row, amount: Number(row.amount), createdAt: row.createdAt.toISOString() });
});

export default router;

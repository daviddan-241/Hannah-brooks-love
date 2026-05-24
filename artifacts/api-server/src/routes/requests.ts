import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { db, requestsTable } from "@workspace/db";
import { CreateRequestBody } from "@workspace/api-zod";
import { activityEmitter } from "../emitter";
import { sendMail, emailFanRequestConfirmed, emailAdminNewRequest } from "../lib/mailer";
import { sendPush } from "../lib/push";
import { platformConfig } from "./settings";

const router: IRouter = Router();

router.get("/requests", async (_req, res): Promise<void> => {
  const rows = await db.select().from(requestsTable).orderBy(desc(requestsTable.createdAt));
  res.json(rows.map((r) => ({
    ...r,
    amountPaid: Number(r.amountPaid),
    createdAt: r.createdAt.toISOString(),
  })));
});

router.post("/requests", async (req, res): Promise<void> => {
  const parsed = CreateRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(requestsTable).values({
    fanEmail: parsed.data.fanEmail,
    fanName: parsed.data.fanName,
    requestType: parsed.data.requestType,
    description: parsed.data.description,
    amountPaid: String(parsed.data.amountPaid),
    txRef: parsed.data.txRef,
    status: "pending",
  }).returning();

  activityEmitter.emit("activity", {
    type: "request",
    fanName: parsed.data.fanName,
    amount: parsed.data.amountPaid,
    detail: `Custom request from ${parsed.data.fanName}: ${parsed.data.requestType}`,
    timestamp: new Date().toISOString(),
  });

  // Email fan confirmation
  const fanTpl = emailFanRequestConfirmed({
    name: parsed.data.fanName,
    requestType: parsed.data.requestType,
    amount: String(parsed.data.amountPaid),
  });
  sendMail({ to: parsed.data.fanEmail, subject: fanTpl.subject, html: fanTpl.html }).catch(() => {});

  // Email admin notification
  const adminEmail = (platformConfig as any).adminEmail;
  if (adminEmail) {
    const adminTpl = emailAdminNewRequest({
      fanName: parsed.data.fanName,
      fanEmail: parsed.data.fanEmail,
      requestType: parsed.data.requestType,
      amount: String(parsed.data.amountPaid),
    });
    sendMail({ to: adminEmail, subject: adminTpl.subject, html: adminTpl.html }).catch(() => {});
  }

  sendPush(`✨ New Custom Request — ${parsed.data.fanName}`, `$${parsed.data.amountPaid} · ${parsed.data.requestType}`, { tag: "request", url: "/admin" }).catch(() => {});

  res.status(201).json({ ...row, amountPaid: Number(row.amountPaid), createdAt: row.createdAt.toISOString() });
});

export default router;

import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { db, callsTable } from "@workspace/db";
import { CreateCallBody, UpdateCallParams, UpdateCallBody } from "@workspace/api-zod";
import { activityEmitter } from "../emitter";
import { sendMail, emailFanCallBooked, emailAdminNewCall } from "../lib/mailer";
import { sendPush } from "../lib/push";
import { platformConfig } from "./settings";

const router: IRouter = Router();

router.get("/calls", async (_req, res): Promise<void> => {
  const rows = await db.select().from(callsTable).orderBy(desc(callsTable.createdAt));
  res.json(rows.map((r) => ({
    ...r,
    amountPaid: Number(r.amountPaid),
    createdAt: r.createdAt.toISOString(),
  })));
});

router.post("/calls", async (req, res): Promise<void> => {
  const parsed = CreateCallBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db.insert(callsTable).values({
    fanEmail: parsed.data.fanEmail,
    fanName: parsed.data.fanName,
    preferredDate: parsed.data.preferredDate,
    durationMinutes: parsed.data.durationMinutes,
    amountPaid: String(parsed.data.amountPaid),
    txRef: parsed.data.txRef,
    notes: parsed.data.notes ?? null,
    status: "pending",
  }).returning();

  activityEmitter.emit("activity", {
    type: "call",
    fanName: parsed.data.fanName,
    amount: parsed.data.amountPaid,
    detail: `Call booked: ${parsed.data.durationMinutes} min with ${parsed.data.fanName}`,
    timestamp: new Date().toISOString(),
  });

  // Email fan confirmation
  const sessionLabel = `${parsed.data.durationMinutes}-min call`;
  const fanTpl = emailFanCallBooked({
    name: parsed.data.fanName,
    session: sessionLabel,
    date: parsed.data.preferredDate,
    amount: String(parsed.data.amountPaid),
  });
  sendMail({ to: parsed.data.fanEmail, subject: fanTpl.subject, html: fanTpl.html }).catch(() => {});

  // Email admin notification
  const adminEmail = (platformConfig as any).adminEmail;
  if (adminEmail) {
    const adminTpl = emailAdminNewCall({
      fanName: parsed.data.fanName,
      fanEmail: parsed.data.fanEmail,
      session: sessionLabel,
      amount: String(parsed.data.amountPaid),
    });
    sendMail({ to: adminEmail, subject: adminTpl.subject, html: adminTpl.html }).catch(() => {});
  }

  sendPush(`📞 New Call Booking — ${parsed.data.fanName}`, `$${parsed.data.amountPaid} · ${sessionLabel}`, { tag: "call", url: "/admin" }).catch(() => {});

  res.status(201).json({ ...row, amountPaid: Number(row.amountPaid), createdAt: row.createdAt.toISOString() });
});

router.patch("/calls/:id", async (req, res): Promise<void> => {
  const params = UpdateCallParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateCallBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .update(callsTable)
    .set({ status: parsed.data.status })
    .where(eq(callsTable.id, params.data.id))
    .returning();
  res.json({ ...row, amountPaid: Number(row.amountPaid), createdAt: row.createdAt.toISOString() });
});

export default router;

import { Router, type IRouter } from "express";
import { addPushSubscription, removePushSubscription, sendPush, VAPID_PUBLIC_KEY } from "../lib/push";

const router: IRouter = Router();

router.get("/push/vapid-key", (_req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

router.post("/push/subscribe", (req, res): void => {
  const sub = req.body as { endpoint?: string };
  if (!sub?.endpoint) { res.status(400).json({ error: "Invalid subscription" }); return; }
  addPushSubscription(req.body);
  res.json({ success: true });
});

router.post("/push/unsubscribe", (req, res): void => {
  const { endpoint } = req.body as { endpoint?: string };
  if (endpoint) removePushSubscription(endpoint);
  res.json({ success: true });
});

router.post("/push/test", async (_req, res): Promise<void> => {
  await sendPush("Sophie Rain Admin", "Push notifications are working! 🎉", {
    url: "/admin",
    tag: "test",
  });
  res.json({ success: true, sent: true });
});

export default router;

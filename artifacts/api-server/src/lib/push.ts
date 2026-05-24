import webpush from "web-push";
import { logger } from "./logger";

const VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY ||
  "BDM_U27gb4qFr3Kvn4Jc4Xdt4JlyOxf7FDkd8J599gP6GnrWbK9IomX9WTF75QVRvcQzE6U1Kd5m69k53KXtXsg";
const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY || "0dGbMSWryHEGe_QiZfnpGp1jg-U3mq-rOMuiXxbKonc";
const VAPID_EMAIL = process.env.VAPID_EMAIL || "admin@sophierain.com";

webpush.setVapidDetails(`mailto:${VAPID_EMAIL}`, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

export { VAPID_PUBLIC_KEY };

const subscriptions = new Map<string, webpush.PushSubscription>();

export function addPushSubscription(sub: webpush.PushSubscription) {
  subscriptions.set(sub.endpoint, sub);
  logger.info({ endpoint: sub.endpoint.slice(-20) }, "Push subscription added");
}

export function removePushSubscription(endpoint: string) {
  subscriptions.delete(endpoint);
}

export async function sendPush(title: string, body: string, opts?: {
  url?: string;
  tag?: string;
  icon?: string;
}) {
  if (subscriptions.size === 0) return;
  const payload = JSON.stringify({
    title,
    body,
    url: opts?.url || "/admin",
    tag: opts?.tag || `sr-${Date.now()}`,
    icon: opts?.icon || "/logo-hb.png",
  });
  const dead: string[] = [];
  await Promise.allSettled(
    [...subscriptions.values()].map(async (sub) => {
      try {
        await webpush.sendNotification(sub, payload);
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          dead.push(sub.endpoint);
        } else {
          logger.warn({ err: err.message }, "Push send failed");
        }
      }
    })
  );
  dead.forEach((ep) => subscriptions.delete(ep));
}

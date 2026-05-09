import { Resend } from "resend";
import type { AppDb } from "@app/db";
import type { Alert } from "@app/db/types";
import { env } from "../env.js";
import { recommendedAction } from "./recommendations.js";

export interface Notifier {
  send(alert: Alert): Promise<void>;
}

export class EmailNotifier implements Notifier {
  private resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

  constructor(private db: AppDb) {}

  async send(alert: Alert) {
    if (alert.severity !== "critical") return;
    if (!this.resend || !env.ALERT_FROM_EMAIL) {
      console.warn("Skipping alert email: RESEND_API_KEY or ALERT_FROM_EMAIL is not configured");
      return;
    }

    const site = await this.db.selectFrom("sites").select(["id", "name"]).where("id", "=", alert.site_id).executeTakeFirstOrThrow();
    const recipients = await this.db
      .selectFrom("users")
      .leftJoin("user_sites", "user_sites.user_id", "users.id")
      .select("users.email")
      .where((eb) => eb.or([eb("users.role", "=", "admin"), eb("user_sites.site_id", "=", alert.site_id)]))
      .distinct()
      .execute();

    const to = recipients.map((row) => row.email).filter(Boolean);
    if (to.length === 0) return;

    await this.resend.emails.send({
      from: env.ALERT_FROM_EMAIL,
      to,
      subject: `[${alert.severity.toUpperCase()}] ${site.name}: ${alert.type}`,
      html: `
        <h2>${site.name}</h2>
        <p><strong>Issue:</strong> ${alert.message}</p>
        <p><strong>Timestamp:</strong> ${alert.created_at.toISOString()}</p>
        <p><strong>Recommended action:</strong> ${recommendedAction(alert.type)}</p>
      `
    });
  }
}

export async function notifyIfCooldownAllows(db: AppDb, notifier: Notifier, alert: Alert) {
  if (alert.severity !== "critical") return;

  const cooldownMs = env.COOLDOWN_MINUTES * 60 * 1000;
  const lastNotifiedAt = alert.last_notified_at ? new Date(alert.last_notified_at).getTime() : 0;
  if (lastNotifiedAt && Date.now() - lastNotifiedAt < cooldownMs) return;

  await notifier.send(alert);
  await db.updateTable("alerts").set({ last_notified_at: new Date() }).where("id", "=", alert.id).execute();
}

import type { AppDb } from "@app/db";
import type { Alert, AlertSeverity } from "@app/db/types";
import type { Notifier } from "./notify.js";
import { notifyIfCooldownAllows } from "./notify.js";

const severityRank: Record<AlertSeverity, number> = {
  info: 1,
  warning: 2,
  critical: 3
};

export async function upsertAlert(
  db: AppDb,
  notifier: Notifier,
  input: {
    siteId: string;
    deviceId?: string | null;
    type: string;
    severity: AlertSeverity;
    message: string;
  }
): Promise<Alert> {
  const existing = await db
    .selectFrom("alerts")
    .selectAll()
    .where("site_id", "=", input.siteId)
    .where("type", "=", input.type)
    .where("status", "=", "active")
    .executeTakeFirst();

  const alert =
    existing ??
    (await db
      .insertInto("alerts")
      .values({
        site_id: input.siteId,
        device_id: input.deviceId ?? null,
        type: input.type,
        severity: input.severity,
        message: input.message,
        status: "active"
      })
      .returningAll()
      .executeTakeFirstOrThrow());

  if (existing) {
    const severity = severityRank[input.severity] > severityRank[existing.severity] ? input.severity : existing.severity;
    const updated = await db
      .updateTable("alerts")
      .set({ message: input.message, severity })
      .where("id", "=", existing.id)
      .returningAll()
      .executeTakeFirstOrThrow();

    await notifyIfCooldownAllows(db, notifier, updated);
    return updated;
  }

  await notifyIfCooldownAllows(db, notifier, alert);
  return alert;
}

export async function resolveActiveAlert(db: AppDb, siteId: string, type: string) {
  await db
    .updateTable("alerts")
    .set({ status: "resolved", resolved_at: new Date() })
    .where("site_id", "=", siteId)
    .where("type", "=", type)
    .where("status", "=", "active")
    .execute();
}

export async function resolveActiveAlertsForTypes(db: AppDb, siteId: string, types: readonly string[]) {
  if (types.length === 0) {
    return;
  }
  await db
    .updateTable("alerts")
    .set({ status: "resolved", resolved_at: new Date() })
    .where("site_id", "=", siteId)
    .where("status", "=", "active")
    .where("type", "in", [...types])
    .execute();
}

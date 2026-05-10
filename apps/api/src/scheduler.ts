import { sql } from "kysely";
import type { AppDb } from "@app/db";
import type { Notifier } from "./alerts/notify.js";
import { notifyIfCooldownAllows } from "./alerts/notify.js";
import { upsertAlert } from "./alerts/upsert.js";

async function checkOfflineDevices(db: AppDb, notifier: Notifier) {
  const devices = await db
    .selectFrom("devices")
    .innerJoin("sites", "sites.id", "devices.site_id")
    .select([
      "devices.id",
      "devices.site_id",
      "devices.device_id",
      "devices.last_seen_at",
      "devices.expected_interval_seconds",
      "sites.name as site_name"
    ])
    .where((eb) =>
      eb.or([
        eb("devices.last_seen_at", "is", null),
        sql<boolean>`devices.last_seen_at < now() - interval '1 hour'`
      ])
    )
    .execute();

  for (const device of devices) {
    if (!device.site_id) continue;
    await upsertAlert(db, notifier, {
      siteId: device.site_id,
      deviceId: device.id,
      type: "device_offline",
      severity: "critical",
      message: `\`${device.device_id}\` at ${device.site_name} has not reported within the expected interval.`
    });
  }
}

async function renotifyCriticalAlerts(db: AppDb, notifier: Notifier) {
  const alerts = await db
    .selectFrom("alerts")
    .selectAll()
    .where("status", "=", "active")
    .where("severity", "=", "critical")
    .execute();

  for (const alert of alerts) {
    await notifyIfCooldownAllows(db, notifier, alert);
  }
}

export function startScheduler(db: AppDb, notifier: Notifier) {
  const runSafely = async (task: () => Promise<void>, name: string) => {
    try {
      await task();
    } catch (error) {
      console.error(`Scheduler task failed: ${name}`, error);
    }
  };

  const offlineTimer = setInterval(() => runSafely(() => checkOfflineDevices(db, notifier), "device_offline"), 60_000);
  const notifyTimer = setInterval(() => runSafely(() => renotifyCriticalAlerts(db, notifier), "renotify"), 5 * 60_000);

  void runSafely(() => checkOfflineDevices(db, notifier), "device_offline");

  return () => {
    clearInterval(offlineTimer);
    clearInterval(notifyTimer);
  };
}

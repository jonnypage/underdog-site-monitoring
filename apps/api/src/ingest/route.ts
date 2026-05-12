import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { AppDb } from "@app/db";
import { detectAnomalies } from "../anomaly/detect.js";
import type { Notifier } from "../alerts/notify.js";
import { resolveActiveAlert, upsertAlert } from "../alerts/upsert.js";
import { getSiteSensorEnabledMap } from "../site/sensor-catalog-db.js";
import { ingestPayloadSchema } from "./validate.js";

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function registerIngestRoute(app: FastifyInstance, db: AppDb, notifier: Notifier) {
  app.post("/ingest", async (request, reply) => {
    const apiKey = request.headers["x-api-key"];
    if (typeof apiKey !== "string" || apiKey.length === 0) {
      return reply.code(401).send({ error: "Missing x-api-key" });
    }

    const parsed = ingestPayloadSchema.safeParse(request.body);
    if (!parsed.success) {
      request.log.warn({ issues: parsed.error.issues }, "Invalid ingest payload");
      return reply.code(400).send({ error: "Invalid payload", issues: parsed.error.issues });
    }

    const payload = parsed.data;
    const device = await db
      .selectFrom("devices")
      .selectAll()
      .where("device_id", "=", payload.deviceId)
      .where("api_key_hash", "=", sha256(apiKey))
      .executeTakeFirst();

    if (!device) {
      return reply.code(401).send({ error: "Invalid device credentials" });
    }

    const siteId = device.site_id;
    if (!siteId) {
      await db.updateTable("devices").set({ last_seen_at: new Date(), updated_at: new Date() }).where("id", "=", device.id).execute();
      return reply.send({ ok: true, inserted: 0, ignored: true });
    }

    const catalogKeys = await db.selectFrom("sensor_catalog").select("key").execute();
    const allowed = new Set(catalogKeys.map((r) => r.key));
    const rawEntries = Object.entries(payload.readings);
    const unknown = rawEntries.map(([k]) => k).filter((k) => !allowed.has(k));
    if (unknown.length > 0) {
      return reply.code(400).send({ error: "Unknown sensor keys", unknown });
    }

    const enabledByKey = await getSiteSensorEnabledMap(db, siteId);
    const readings = (rawEntries as [string, number][]).map(([sensor, value]) => [
      sensor,
      Number(value.toFixed(2))
    ] as [string, number]);

    const takenAt = new Date(payload.timestamp);

    await db.transaction().execute(async (trx) => {
      if (readings.length > 0) {
        await trx
          .insertInto("measurements")
          .values(
            readings.map(([sensor, value]) => ({
              site_id: siteId,
              device_id: device.id,
              sensor,
              value,
              taken_at: takenAt
            }))
          )
          .execute();
      }

      await trx
        .updateTable("devices")
        .set({ last_seen_at: new Date(), updated_at: new Date() })
        .where("id", "=", device.id)
        .execute();

      await resolveActiveAlert(trx, siteId, "device_offline");
    });

    for (const [sensor, value] of readings) {
      if (enabledByKey[sensor] === false) {
        continue;
      }
      const anomalies = await detectAnomalies(db, siteId, sensor, value);
      for (const anomaly of anomalies) {
        await upsertAlert(db, notifier, {
          siteId,
          deviceId: device.id,
          type: anomaly.type,
          severity: anomaly.severity,
          message: anomaly.message
        });
      }
    }

    return reply.send({ ok: true, inserted: readings.length });
  });
}

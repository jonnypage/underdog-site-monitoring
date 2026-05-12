import { sql } from "kysely";
import type { Context } from "../../context.js";
import { requireSiteAccess } from "../../rbac.js";
import { getSiteSensorEnabledMap } from "../../site/sensor-catalog-db.js";

const rangeHours = {
  LAST_24H: 24,
  LAST_7D: 24 * 7,
  LAST_30D: 24 * 30
} as const;

export const measurementQueries = {
  getMeasurements: async (
    _parent: unknown,
    args: { siteId: string; range: keyof typeof rangeHours },
    context: Context
  ) => {
    await requireSiteAccess(context.db, context.user, args.siteId);
    const enabledMap = await getSiteSensorEnabledMap(context.db, args.siteId);
    const enabledSensors = Object.keys(enabledMap).filter((k) => enabledMap[k] !== false);
    if (enabledSensors.length === 0) {
      return [];
    }

    const since = new Date(Date.now() - rangeHours[args.range] * 60 * 60 * 1000);

    const rows = await context.db
      .selectFrom("measurements")
      .select((eb) => [
        "sensor",
        eb.fn.avg<number>("value").as("value"),
        sql<Date>`to_timestamp(floor(extract(epoch from taken_at) / 43200) * 43200)`.as("taken_at")
      ])
      .where("site_id", "=", args.siteId)
      .where("sensor", "in", enabledSensors)
      .where("taken_at", ">=", since)
      .groupBy(["sensor", sql`to_timestamp(floor(extract(epoch from taken_at) / 43200) * 43200)`])
      .orderBy("taken_at", "asc")
      .execute();

    return rows.map((row) => ({
      sensor: row.sensor,
      value: Number(Number(row.value).toFixed(2)),
      takenAt: row.taken_at
    }));
  },

  getSensorMeasurements: async (
    _parent: unknown,
    args: { siteId: string; sensorKey: string; range: keyof typeof rangeHours },
    context: Context
  ) => {
    await requireSiteAccess(context.db, context.user, args.siteId);
    // Double check the sensor is actually enabled for this site
    const enabledMap = await getSiteSensorEnabledMap(context.db, args.siteId);
    if (enabledMap[args.sensorKey] === false) {
      return [];
    }

    const since = new Date(Date.now() - rangeHours[args.range] * 60 * 60 * 1000);
    
    // Dynamic time-bucketing based on the requested range for an optimal ~100-200 points
    const bucketSeconds = 
      args.range === "LAST_24H" ? 900 // 15 mins (96 points)
      : args.range === "LAST_7D" ? 3600 // 1 hour (168 points)
      : 21600; // 6 hours (120 points)

    const rows = await context.db
      .selectFrom("measurements")
      .select((eb) => [
        "sensor",
        eb.fn.avg<number>("value").as("value"),
        sql<Date>`to_timestamp(floor(extract(epoch from taken_at) / ${sql.raw(bucketSeconds.toString())}) * ${sql.raw(bucketSeconds.toString())})`.as("taken_at")
      ])
      .where("site_id", "=", args.siteId)
      .where("sensor", "=", args.sensorKey)
      .where("taken_at", ">=", since)
      .groupBy(["sensor", sql`to_timestamp(floor(extract(epoch from taken_at) / ${sql.raw(bucketSeconds.toString())}) * ${sql.raw(bucketSeconds.toString())})`])
      .orderBy("taken_at", "asc")
      .execute();

    return rows.map((row) => ({
      sensor: row.sensor,
      value: Number(Number(row.value).toFixed(2)),
      takenAt: row.taken_at
    }));
  }
};

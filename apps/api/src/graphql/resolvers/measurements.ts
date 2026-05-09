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
      .select(["sensor", "value", "taken_at"])
      .where("site_id", "=", args.siteId)
      .where("sensor", "in", enabledSensors)
      .where("taken_at", ">=", since)
      .orderBy("taken_at", "asc")
      .execute();

    return rows.map((row) => ({
      sensor: row.sensor,
      value: row.value,
      takenAt: row.taken_at
    }));
  }
};

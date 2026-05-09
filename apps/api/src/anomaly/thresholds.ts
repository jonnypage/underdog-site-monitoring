import type { AppDb } from "@app/db";
import type { SensorType } from "@app/db/types";
import { isSensorType } from "../site/sensor-reporting.js";

export interface Threshold {
  min: number | null;
  max: number | null;
  warningMin: number | null;
  warningMax: number | null;
  recommendation: string;
}

/** Legacy copy for recommendation text on MVP sensor keys only. */
const recommendationBySensor: Record<SensorType, string> = {
  temperature: "Check heater, shade, pump flow, and recent weather exposure.",
  ph: "Retest pH, inspect dosing history, and adjust gradually.",
  dissolvedOxygen: "Check aeration, water circulation, stocking density, and biofilter flow.",
  waterLevel: "Inspect for leaks, stuck valves, clogged drains, or failed top-off supply."
};

/** Preferred band inside [min, max] when both critical bounds exist (15% inset each side). */
function deriveWarningBand(min: number | null, max: number | null): { warningMin: number | null; warningMax: number | null } {
  if (min == null || max == null || !(min < max)) {
    return { warningMin: null, warningMax: null };
  }
  const span = max - min;
  const inset = span * 0.15;
  return { warningMin: min + inset, warningMax: max - inset };
}

/**
 * Effective critical range = per-site overrides in `sensor_thresholds` when set,
 * otherwise `sensor_catalog` physical_min / physical_max.
 */
export async function getThreshold(db: AppDb, siteId: string, sensorKey: string): Promise<Threshold> {
  const catalog = await db
    .selectFrom("sensor_catalog")
    .select(["physical_min", "physical_max", "display_name"])
    .where("key", "=", sensorKey)
    .executeTakeFirst();

  const row = await db
    .selectFrom("sensor_thresholds")
    .select(["min_value", "max_value"])
    .where("site_id", "=", siteId)
    .where("sensor", "=", sensorKey)
    .executeTakeFirst();

  const min = row != null && row.min_value !== null ? row.min_value : catalog?.physical_min ?? null;
  const max = row != null && row.max_value !== null ? row.max_value : catalog?.physical_max ?? null;

  const { warningMin, warningMax } = deriveWarningBand(min, max);

  const label = catalog?.display_name ?? sensorKey;
  const recommendation = isSensorType(sensorKey)
    ? recommendationBySensor[sensorKey]
    : `Review ${label} readings and site-specific thresholds in the admin console.`;

  return {
    min,
    max,
    warningMin,
    warningMax,
    recommendation
  };
}

import { sql } from "kysely";
import type { AppDb } from "@app/db";
import type { AlertSeverity, SensorType } from "@app/db/types";
import { getThreshold } from "./thresholds.js";
import { isSensorType } from "../site/sensor-reporting.js";

export interface DetectedAnomaly {
  type: string;
  severity: AlertSeverity;
  message: string;
}

const alertTypeBySensor: Record<SensorType, string> = {
  temperature: "temperature_spike",
  ph: "ph_drift",
  dissolvedOxygen: "low_oxygen",
  waterLevel: "water_level_issue"
};

function criticalAlertType(sensorKey: string): string {
  return isSensorType(sensorKey) ? alertTypeBySensor[sensorKey] : `range_violation:${sensorKey}`;
}

function warningAlertType(sensorKey: string): string {
  return isSensorType(sensorKey) ? alertTypeBySensor[sensorKey] : `range_warning:${sensorKey}`;
}

export async function detectAnomalies(db: AppDb, siteId: string, sensorKey: string, value: number): Promise<DetectedAnomaly[]> {
  const threshold = await getThreshold(db, siteId, sensorKey);
  const anomalies: DetectedAnomaly[] = [];

  const catalog = await db
    .selectFrom("sensor_catalog")
    .select("display_name")
    .where("key", "=", sensorKey)
    .executeTakeFirst();
  const label = catalog?.display_name ?? sensorKey;

  const critT = criticalAlertType(sensorKey);
  const warnT = warningAlertType(sensorKey);

  if (threshold.min !== null && value < threshold.min) {
    anomalies.push({
      type: critT,
      severity: "critical",
      message: `${label} is critically low (${value}).`
    });
  } else if (threshold.max !== null && value > threshold.max) {
    anomalies.push({
      type: critT,
      severity: "critical",
      message: `${label} is critically high (${value}).`
    });
  } else if (
    (threshold.warningMin !== null && value < threshold.warningMin) ||
    (threshold.warningMax !== null && value > threshold.warningMax)
  ) {
    anomalies.push({
      type: warnT,
      severity: "warning",
      message: `${label} is outside the preferred operating range (${value}).`
    });
  }

  if (!isSensorType(sensorKey)) {
    return anomalies;
  }

  const sensor = sensorKey as SensorType;

  const stats = await db
    .selectFrom("measurements")
    .select((eb) => [
      eb.fn.avg<number>("value").as("avg_value"),
      sql<number>`coalesce(stddev_pop(value), 0)`.as("stddev_value"),
      eb.fn.count<number>("id").as("sample_count")
    ])
    .where("site_id", "=", siteId)
    .where("sensor", "=", sensor)
    .where("taken_at", ">=", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    .executeTakeFirst();

  if (stats && Number(stats.sample_count) >= 20) {
    const average = Number(stats.avg_value);
    const stddev = Math.max(Number(stats.stddev_value), 0.25);
    if (Math.abs(value - average) > 4 * stddev) {
      anomalies.push({
        type: alertTypeBySensor[sensor],
        severity: "warning",
        message: `${label} changed sharply (${value}, baseline ${average.toFixed(2)}).`
      });
    }
  }

  const recent = await db
    .selectFrom("measurements")
    .select("value")
    .where("site_id", "=", siteId)
    .where("sensor", "=", sensor)
    .orderBy("taken_at", "desc")
    .limit(20)
    .execute();

  if (recent.length >= 20) {
    const values = recent.map((row) => row.value);
    const mean = values.reduce((sum, item) => sum + item, 0) / values.length;
    const variance = values.reduce((sum, item) => sum + (item - mean) ** 2, 0) / values.length;
    if (Math.sqrt(variance) < 0.01) {
      anomalies.push({
        type: `${alertTypeBySensor[sensor]}_flatline`,
        severity: "warning",
        message: `${label} has been flat for the last 20 readings. Check the sensor.`
      });
    }
  }

  return anomalies;
}

import type { SensorType } from "@app/db/types";

/** Sensor keys that participate in anomaly / alert mapping (must match `sensor_catalog.key` rows). */
export const SENSOR_TYPES: SensorType[] = ["temperature", "ph", "waterLevel", "dissolvedOxygen"];

export function isSensorType(value: string): value is SensorType {
  return (SENSOR_TYPES as string[]).includes(value);
}

export function alertTypesForSensor(sensor: SensorType): string[] {
  const base: Record<SensorType, string> = {
    temperature: "temperature_spike",
    ph: "ph_drift",
    dissolvedOxygen: "low_oxygen",
    waterLevel: "water_level_issue"
  };
  const b = base[sensor];
  return [b, `${b}_flatline`];
}

/** All alert `type` strings that should clear when a sensor is disabled for a site. */
export function alertTypesForSensorKey(sensorKey: string): string[] {
  if (isSensorType(sensorKey)) {
    return alertTypesForSensor(sensorKey);
  }
  return [`range_violation:${sensorKey}`, `range_warning:${sensorKey}`];
}

/** Maps alert `type` to a sensor catalog key, or `device` for device_offline, or null if unknown */
export function alertTypeToReportingTarget(alertType: string): string | "device" | null {
  if (alertType === "device_offline") {
    return "device";
  }
  const rv = /^range_violation:(.+)$/.exec(alertType);
  if (rv) {
    return rv[1]!;
  }
  const rw = /^range_warning:(.+)$/.exec(alertType);
  if (rw) {
    return rw[1]!;
  }
  for (const s of SENSOR_TYPES) {
    if (alertTypesForSensor(s).includes(alertType)) {
      return s;
    }
  }
  return null;
}

/** Whether an alert should appear in the UI for a site, given enabled flags keyed by catalog `key`. */
export function shouldSurfaceAlert(alertType: string, enabledBySensorKey: Record<string, boolean>): boolean {
  const target = alertTypeToReportingTarget(alertType);
  if (target === null || target === "device") {
    return true;
  }
  return enabledBySensorKey[target] !== false;
}

export function normalizeCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined
): { latitude: number | null; longitude: number | null } {
  const latMissing = latitude === undefined || latitude === null;
  const lngMissing = longitude === undefined || longitude === null;
  if (latMissing && lngMissing) {
    return { latitude: null, longitude: null };
  }
  if (latMissing !== lngMissing) {
    throw new Error("Latitude and longitude must both be set or both be cleared");
  }
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error("Invalid coordinates");
  }
  if (lat < -90 || lat > 90) {
    throw new Error("Latitude must be between -90 and 90");
  }
  if (lng < -180 || lng > 180) {
    throw new Error("Longitude must be between -180 and 180");
  }
  return { latitude: lat, longitude: lng };
}

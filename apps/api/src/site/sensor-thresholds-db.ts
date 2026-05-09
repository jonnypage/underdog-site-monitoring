import type { AppDb } from "@app/db";

export type SiteSensorThresholdInput = { key: string; minValue: number | null; maxValue: number | null };

function assertOverrideRange(min: number | null, max: number | null) {
  if (min != null && max != null && min > max) {
    throw new Error("Threshold minimum must be less than or equal to maximum");
  }
}

/**
 * Replace sparse threshold rows: a row is inserted only when at least one bound is overridden
 * (non-null). SQL NULL on a column means "use catalog default" for that bound and requires a row
 * only when the other column is set — so we always delete all rows for the site and insert
 * one row per sensor that has any override.
 */
export async function replaceSiteSensorThresholds(db: AppDb, siteId: string, rows: SiteSensorThresholdInput[]): Promise<void> {
  const catalog = await db.selectFrom("sensor_catalog").select(["key"]).execute();
  const allowed = new Set(catalog.map((c) => c.key));
  if (rows.length !== catalog.length) {
    throw new Error(`Expected ${catalog.length} threshold entries (one per catalog sensor)`);
  }
  const seen = new Set<string>();
  for (const r of rows) {
    if (!allowed.has(r.key)) {
      throw new Error(`Unknown sensor key: ${r.key}`);
    }
    if (seen.has(r.key)) {
      throw new Error(`Duplicate sensor key: ${r.key}`);
    }
    seen.add(r.key);
    assertOverrideRange(r.minValue, r.maxValue);
  }

  const now = new Date();
  await db.deleteFrom("sensor_thresholds").where("site_id", "=", siteId).execute();

  const toInsert = rows.filter((r) => r.minValue !== null || r.maxValue !== null);
  if (toInsert.length === 0) return;

  await db
    .insertInto("sensor_thresholds")
    .values(
      toInsert.map((r) => ({
        site_id: siteId,
        sensor: r.key,
        min_value: r.minValue,
        max_value: r.maxValue,
        created_at: now,
        updated_at: now
      }))
    )
    .execute();
}

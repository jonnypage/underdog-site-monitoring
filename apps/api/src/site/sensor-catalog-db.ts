import type { AppDb } from "@app/db";

const SENSOR_KEY_RE = /^[a-zA-Z][a-zA-Z0-9_]*$/;

export function assertValidSensorCatalogKey(key: string): string {
  const k = key.trim();
  if (!SENSOR_KEY_RE.test(k)) {
    throw new Error(
      "Sensor key must start with a letter and use only letters, numbers, and underscores (e.g. dissolvedOxygen)."
    );
  }
  return k;
}

export function assertPhysicalRange(min: number | null, max: number | null) {
  if (min != null && max != null && min > max) {
    throw new Error("Physical minimum must be less than or equal to maximum");
  }
}

export type SensorCatalogRow = {
  id: string;
  key: string;
  display_name: string;
  unit: string;
  physical_min: number | null;
  physical_max: number | null;
  sort_order: number;
};

export async function listSensorCatalog(db: AppDb): Promise<SensorCatalogRow[]> {
  return db
    .selectFrom("sensor_catalog")
    .select(["id", "key", "display_name", "unit", "physical_min", "physical_max", "sort_order"])
    .orderBy("sort_order", "asc")
    .orderBy("key", "asc")
    .execute();
}

export type SiteSensorReportingRow = {
  key: string;
  display_name: string;
  unit: string;
  physical_min: number | null;
  physical_max: number | null;
  range_min: number | null;
  range_max: number | null;
  threshold_min_override: number | null;
  threshold_max_override: number | null;
  enabled: boolean;
};

async function loadSiteThresholdMaps(
  db: AppDb,
  siteIds: string[]
): Promise<Map<string, Map<string, { min_value: number | null; max_value: number | null }>>> {
  const result = new Map<string, Map<string, { min_value: number | null; max_value: number | null }>>();
  if (siteIds.length === 0) return result;
  for (const sid of siteIds) {
    result.set(sid, new Map());
  }
  const rows = await db
    .selectFrom("sensor_thresholds")
    .select(["site_id", "sensor", "min_value", "max_value"])
    .where("site_id", "in", siteIds)
    .execute();
  for (const r of rows) {
    const m = result.get(r.site_id);
    if (m) {
      m.set(r.sensor, { min_value: r.min_value, max_value: r.max_value });
    }
  }
  return result;
}

function mergeReportingRow(
  siteId: string,
  row: {
    key: string;
    display_name: string;
    unit: string;
    physical_min: number | null;
    physical_max: number | null;
    enabled: boolean;
  },
  thMaps: Map<string, Map<string, { min_value: number | null; max_value: number | null }>>
): SiteSensorReportingRow {
  const t = thMaps.get(siteId)?.get(row.key);
  const threshold_min_override = t != null && t.min_value !== null ? t.min_value : null;
  const threshold_max_override = t != null && t.max_value !== null ? t.max_value : null;
  const range_min = threshold_min_override !== null ? threshold_min_override : row.physical_min;
  const range_max = threshold_max_override !== null ? threshold_max_override : row.physical_max;
  return {
    key: row.key,
    display_name: row.display_name,
    unit: row.unit,
    physical_min: row.physical_min,
    physical_max: row.physical_max,
    range_min,
    range_max,
    threshold_min_override,
    threshold_max_override,
    enabled: row.enabled
  };
}

export async function getSiteSensorReportingForGraphql(db: AppDb, siteId: string): Promise<SiteSensorReportingRow[]> {
  const rows = await db
    .selectFrom("site_sensor_catalog")
    .innerJoin("sensor_catalog", "sensor_catalog.id", "site_sensor_catalog.sensor_catalog_id")
    .select([
      "sensor_catalog.key",
      "sensor_catalog.display_name",
      "sensor_catalog.unit",
      "sensor_catalog.physical_min",
      "sensor_catalog.physical_max",
      "site_sensor_catalog.enabled"
    ])
    .where("site_sensor_catalog.site_id", "=", siteId)
    .orderBy("sensor_catalog.sort_order", "asc")
    .orderBy("sensor_catalog.key", "asc")
    .execute();

  const thMaps = await loadSiteThresholdMaps(db, [siteId]);
  return rows.map((r) => mergeReportingRow(siteId, r, thMaps));
}

/** Enabled state keyed by sensor catalog `key` (only rows present for the site). */
export async function getSiteSensorEnabledMap(db: AppDb, siteId: string): Promise<Record<string, boolean>> {
  const rows = await db
    .selectFrom("site_sensor_catalog")
    .innerJoin("sensor_catalog", "sensor_catalog.id", "site_sensor_catalog.sensor_catalog_id")
    .select(["sensor_catalog.key", "site_sensor_catalog.enabled"])
    .where("site_sensor_catalog.site_id", "=", siteId)
    .execute();

  const out: Record<string, boolean> = {};
  for (const r of rows) {
    out[r.key] = r.enabled;
  }
  return out;
}

export async function getSitesSensorEnabledMaps(
  db: AppDb,
  siteIds: string[]
): Promise<Map<string, Record<string, boolean>>> {
  const result = new Map<string, Record<string, boolean>>();
  if (siteIds.length === 0) return result;

  const rows = await db
    .selectFrom("site_sensor_catalog")
    .innerJoin("sensor_catalog", "sensor_catalog.id", "site_sensor_catalog.sensor_catalog_id")
    .select(["site_sensor_catalog.site_id", "sensor_catalog.key", "site_sensor_catalog.enabled"])
    .where("site_sensor_catalog.site_id", "in", siteIds)
    .execute();

  for (const sid of siteIds) {
    result.set(sid, {});
  }
  for (const r of rows) {
    const m = result.get(r.site_id);
    if (m) {
      m[r.key] = r.enabled;
    }
  }
  return result;
}

export async function ensureSiteSensorRowsForNewSite(db: AppDb, siteId: string, defaultEnabled = true) {
  const catalog = await db.selectFrom("sensor_catalog").select("id").execute();
  if (catalog.length === 0) return;

  const now = new Date();
  await db
    .insertInto("site_sensor_catalog")
    .values(
      catalog.map((c) => ({
        site_id: siteId,
        sensor_catalog_id: c.id,
        enabled: defaultEnabled,
        created_at: now,
        updated_at: now
      }))
    )
    .execute();
}

export async function getSitesSensorReportingBatch(
  db: AppDb,
  siteIds: string[]
): Promise<Map<string, SiteSensorReportingRow[]>> {
  const result = new Map<string, SiteSensorReportingRow[]>();
  if (siteIds.length === 0) return result;

  const rows = await db
    .selectFrom("site_sensor_catalog")
    .innerJoin("sensor_catalog", "sensor_catalog.id", "site_sensor_catalog.sensor_catalog_id")
    .select([
      "site_sensor_catalog.site_id",
      "sensor_catalog.key",
      "sensor_catalog.display_name",
      "sensor_catalog.unit",
      "sensor_catalog.physical_min",
      "sensor_catalog.physical_max",
      "site_sensor_catalog.enabled"
    ])
    .where("site_sensor_catalog.site_id", "in", siteIds)
    .orderBy("sensor_catalog.sort_order", "asc")
    .orderBy("sensor_catalog.key", "asc")
    .execute();

  const thMaps = await loadSiteThresholdMaps(db, siteIds);

  for (const sid of siteIds) {
    result.set(sid, []);
  }
  for (const r of rows) {
    const list = result.get(r.site_id);
    if (list) {
      list.push(
        mergeReportingRow(
          r.site_id,
          {
            key: r.key,
            display_name: r.display_name,
            unit: r.unit,
            physical_min: r.physical_min,
            physical_max: r.physical_max,
            enabled: r.enabled
          },
          thMaps
        )
      );
    }
  }
  return result;
}

/**
 * Apply admin checklist: every catalog sensor must appear exactly once in `rows`.
 * Validates keys exist in catalog.
 */
export async function createSensorCatalogEntry(
  db: AppDb,
  params: {
    key: string;
    display_name: string;
    unit: string;
    physical_min: number | null;
    physical_max: number | null;
    sort_order: number | null | undefined;
  }
) {
  const key = assertValidSensorCatalogKey(params.key);
  assertPhysicalRange(params.physical_min, params.physical_max);
  const display_name = params.display_name.trim();
  const unit = params.unit.trim();
  if (!display_name) {
    throw new Error("Display name is required");
  }
  if (!unit) {
    throw new Error("Unit is required");
  }

  const dup = await db.selectFrom("sensor_catalog").select("id").where("key", "=", key).executeTakeFirst();
  if (dup) {
    throw new Error(`A sensor with key "${key}" already exists`);
  }

  let sort_order: number;
  if (params.sort_order != null && Number.isFinite(params.sort_order)) {
    sort_order = Math.trunc(params.sort_order);
  } else {
    const row = await db
      .selectFrom("sensor_catalog")
      .select((eb) => eb.fn.max<number>("sort_order").as("m"))
      .executeTakeFirst();
    sort_order = Number(row?.m ?? 0) + 1;
  }

  const now = new Date();
  const inserted = await db
    .insertInto("sensor_catalog")
    .values({
      key,
      display_name,
      unit,
      physical_min: params.physical_min,
      physical_max: params.physical_max,
      sort_order,
      created_at: now,
      updated_at: now
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  const sites = await db.selectFrom("sites").select("id").execute();
  if (sites.length > 0) {
    await db
      .insertInto("site_sensor_catalog")
      .values(
        sites.map((s) => ({
          site_id: s.id,
          sensor_catalog_id: inserted.id,
          enabled: true,
          created_at: now,
          updated_at: now
        }))
      )
      .execute();
  }

  return inserted;
}

export async function updateSensorCatalogEntry(
  db: AppDb,
  id: string,
  patch: {
    display_name?: string;
    unit?: string;
    physical_min?: number | null;
    physical_max?: number | null;
    sort_order?: number;
  }
) {
  const existing = await db.selectFrom("sensor_catalog").selectAll().where("id", "=", id).executeTakeFirst();
  if (!existing) {
    throw new Error("Sensor not found");
  }

  const nextMin = patch.physical_min !== undefined ? patch.physical_min : existing.physical_min;
  const nextMax = patch.physical_max !== undefined ? patch.physical_max : existing.physical_max;
  assertPhysicalRange(nextMin, nextMax);

  const row: Record<string, unknown> = { updated_at: new Date() };
  if (patch.display_name !== undefined) {
    const v = patch.display_name.trim();
    if (!v) {
      throw new Error("Display name is required");
    }
    row.display_name = v;
  }
  if (patch.unit !== undefined) {
    const v = patch.unit.trim();
    if (!v) {
      throw new Error("Unit is required");
    }
    row.unit = v;
  }
  if (patch.physical_min !== undefined) {
    row.physical_min = patch.physical_min;
  }
  if (patch.physical_max !== undefined) {
    row.physical_max = patch.physical_max;
  }
  if (patch.sort_order !== undefined && Number.isFinite(patch.sort_order)) {
    row.sort_order = Math.trunc(patch.sort_order);
  }

  if (Object.keys(row).length <= 1) {
    return existing;
  }

  await db.updateTable("sensor_catalog").set(row as never).where("id", "=", id).execute();
  return db.selectFrom("sensor_catalog").selectAll().where("id", "=", id).executeTakeFirstOrThrow();
}

export async function replaceSiteSensorReporting(
  db: AppDb,
  siteId: string,
  rows: { key: string; enabled: boolean }[]
): Promise<void> {
  const catalog = await listSensorCatalog(db);
  const byKey = new Map(catalog.map((c) => [c.key, c]));
  if (rows.length !== catalog.length) {
    throw new Error(`Expected ${catalog.length} sensor reporting entries (one per catalog sensor)`);
  }
  const seen = new Set<string>();
  for (const r of rows) {
    if (!byKey.has(r.key)) {
      throw new Error(`Unknown sensor key: ${r.key}`);
    }
    if (seen.has(r.key)) {
      throw new Error(`Duplicate sensor key: ${r.key}`);
    }
    seen.add(r.key);
  }

  const now = new Date();
  for (const r of rows) {
    const c = byKey.get(r.key)!;
    await db
      .updateTable("site_sensor_catalog")
      .set({ enabled: r.enabled, updated_at: now })
      .where("site_id", "=", siteId)
      .where("sensor_catalog_id", "=", c.id)
      .execute();
  }
}

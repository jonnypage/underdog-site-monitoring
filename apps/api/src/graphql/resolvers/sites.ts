import { sql } from "kysely";
import type { Context } from "../../context.js";
import { requireSiteAccess, requireUser } from "../../rbac.js";
import { getSitesSensorReportingBatch, type SiteSensorReportingRow } from "../../site/sensor-catalog-db.js";
import { shouldSurfaceAlert } from "../../site/sensor-reporting.js";

type SiteStatus = "healthy" | "warning" | "critical";

type SiteRow = {
  id: string;
  name: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
};

function enabledMapFromReporting(
  rows: { key: string; enabled: boolean }[]
): Record<string, boolean> {
  const m: Record<string, boolean> = {};
  for (const r of rows) {
    m[r.key] = r.enabled;
  }
  return m;
}

async function getSiteStatus(context: Context, siteId: string, enabledByKey: Record<string, boolean>): Promise<SiteStatus> {
  const rows = await context.db
    .selectFrom("alerts")
    .select(["severity", "type"])
    .where("site_id", "=", siteId)
    .where("status", "=", "active")
    .where("severity", "in", ["warning", "critical"])
    .orderBy(sql`case severity when 'critical' then 1 else 2 end`)
    .execute();

  for (const row of rows) {
    if (!shouldSurfaceAlert(row.type, enabledByKey)) {
      continue;
    }
    return row.severity === "critical" ? "critical" : "warning";
  }
  return "healthy";
}

async function getLastUpdate(context: Context, siteId: string, enabledByKey: Record<string, boolean>) {
  const enabled = Object.keys(enabledByKey).filter((k) => enabledByKey[k] !== false);
  if (enabled.length === 0) {
    return null;
  }
  const row = await context.db
    .selectFrom("measurements")
    .select((eb) => eb.fn.max("taken_at").as("last_update"))
    .where("site_id", "=", siteId)
    .where("sensor", "in", enabled)
    .executeTakeFirst();

  return row?.last_update ?? null;
}

function gqlSensorReporting(rows: SiteSensorReportingRow[]) {
  return rows.map((r) => ({
    key: r.key,
    displayName: r.display_name,
    unit: r.unit,
    physicalMin: r.physical_min,
    physicalMax: r.physical_max,
    rangeMin: r.range_min,
    rangeMax: r.range_max,
    thresholdMinOverride: r.threshold_min_override,
    thresholdMaxOverride: r.threshold_max_override,
    enabled: r.enabled
  }));
}

async function formatSite(
  context: Context,
  site: SiteRow,
  reportingRows: SiteSensorReportingRow[]
) {
  const enabledByKey = enabledMapFromReporting(reportingRows);
  return {
    id: site.id,
    name: site.name,
    location: site.location,
    latitude: site.latitude,
    longitude: site.longitude,
    sensorReporting: gqlSensorReporting(reportingRows),
    status: await getSiteStatus(context, site.id, enabledByKey),
    lastUpdate: await getLastUpdate(context, site.id, enabledByKey),
    role: context.user?.role ?? "site_viewer"
  };
}

const siteSelect = ["sites.id", "sites.name", "sites.location", "sites.latitude", "sites.longitude"] as const;

export const siteQueries = {
  getSites: async (_parent: unknown, _args: unknown, context: Context) => {
    const user = requireUser(context.user);
    const query =
      user.role === "admin"
        ? context.db.selectFrom("sites").select([...siteSelect]).orderBy("sites.name")
        : context.db
            .selectFrom("sites")
            .innerJoin("user_sites", "user_sites.site_id", "sites.id")
            .select([...siteSelect])
            .where("user_sites.user_id", "=", user.id)
            .orderBy("sites.name");

    const sites = await query.execute();
    const batch = await getSitesSensorReportingBatch(
      context.db,
      sites.map((s) => s.id)
    );

    return Promise.all(
      sites.map((site) => {
        const rep = batch.get(site.id) ?? [];
        return formatSite(context, site as SiteRow, rep);
      })
    );
  },

  getSite: async (_parent: unknown, args: { id: string }, context: Context) => {
    await requireSiteAccess(context.db, context.user, args.id);
    const site = await context.db
      .selectFrom("sites")
      .select(["id", "name", "location", "latitude", "longitude"])
      .where("id", "=", args.id)
      .executeTakeFirst();

    if (!site) return null;

    const batch = await getSitesSensorReportingBatch(context.db, [site.id]);
    const rep = batch.get(site.id) ?? [];
    return formatSite(context, site as SiteRow, rep);
  }
};

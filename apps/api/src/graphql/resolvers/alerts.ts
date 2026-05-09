import type { Context } from "../../context.js";
import { requireSiteAccess, requireUser } from "../../rbac.js";
import { getSitesSensorEnabledMaps } from "../../site/sensor-catalog-db.js";
import { shouldSurfaceAlert } from "../../site/sensor-reporting.js";

export const alertQueries = {
  getAlerts: async (
    _parent: unknown,
    args: { siteId?: string | null; type?: string | null; status?: string | null },
    context: Context
  ) => {
    const user = requireUser(context.user);

    if (args.siteId) {
      await requireSiteAccess(context.db, context.user, args.siteId);
    }

    let query = context.db.selectFrom("alerts").select([
      "alerts.id",
      "alerts.site_id",
      "alerts.type",
      "alerts.severity",
      "alerts.status",
      "alerts.message",
      "alerts.created_at",
      "alerts.resolved_at"
    ]);

    if (user.role !== "admin") {
      query = query.innerJoin("user_sites", "user_sites.site_id", "alerts.site_id").where("user_sites.user_id", "=", user.id);
    }
    if (args.siteId) query = query.where("alerts.site_id", "=", args.siteId);
    if (args.type) query = query.where("alerts.type", "=", args.type);
    if (args.status) query = query.where("alerts.status", "=", args.status as "active" | "resolved");

    const rows = await query.orderBy("alerts.created_at", "desc").execute();

    const siteIds = [...new Set(rows.map((r) => r.site_id))];
    const maps = await getSitesSensorEnabledMaps(context.db, siteIds);

    return rows
      .filter((row) => shouldSurfaceAlert(row.type, maps.get(row.site_id) ?? {}))
      .map((row) => ({
        id: row.id,
        siteId: row.site_id,
        type: row.type,
        severity: row.severity,
        status: row.status,
        message: row.message,
        createdAt: row.created_at,
        resolvedAt: row.resolved_at
      }));
  }
};

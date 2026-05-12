import bcrypt from "bcryptjs";
import type { UserRole } from "@app/db/types";
import { resolveActiveAlertsForTypes } from "../../alerts/upsert.js";
import type { Context } from "../../context.js";
import { requireAdmin } from "../../rbac.js";
import {
  createSensorCatalogEntry,
  ensureSiteSensorRowsForNewSite,
  getSiteSensorReportingForGraphql,
  getSitesSensorReportingBatch,
  listSensorCatalog,
  replaceSiteSensorReporting,
  updateSensorCatalogEntry
} from "../../site/sensor-catalog-db.js";
import { replaceSiteSensorThresholds } from "../../site/sensor-thresholds-db.js";
import { alertTypesForSensorKey, normalizeCoordinates } from "../../site/sensor-reporting.js";

const ROLES: UserRole[] = ["admin", "site_manager", "site_viewer"];

function parseRole(value: string): UserRole {
  if (!ROLES.includes(value as UserRole)) {
    throw new Error("Invalid role");
  }
  return value as UserRole;
}

function gqlSensorReporting(rows: Awaited<ReturnType<typeof getSiteSensorReportingForGraphql>>) {
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
    enabled: r.enabled,
    icon: r.icon
  }));
}

async function replaceUserSiteAssignments(db: Context["db"], userId: string, siteIds: string[]) {
  const unique = [...new Set(siteIds)];
  await db.deleteFrom("user_sites").where("user_id", "=", userId).execute();
  if (unique.length === 0) return;
  await db
    .insertInto("user_sites")
    .values(unique.map((site_id) => ({ user_id: userId, site_id })))
    .execute();
}

async function assertCanChangeAdminRole(db: Context["db"], userId: string, wasAdmin: boolean, willBeAdmin: boolean) {
  if (wasAdmin && !willBeAdmin) {
    const row = await db
      .selectFrom("users")
      .select((eb) => eb.fn.count<number>("id").as("n"))
      .where("role", "=", "admin")
      .executeTakeFirst();
    const n = Number(row?.n ?? 0);
    if (n <= 1) {
      throw new Error("Cannot remove the last administrator");
    }
  }
}

export const adminQueries = {
  sensorCatalog: async (_parent: unknown, _args: unknown, context: Context) => {
    requireAdmin(context.user);
    const rows = await listSensorCatalog(context.db);
    return rows.map((r) => ({
      id: r.id,
      key: r.key,
      displayName: r.display_name,
      unit: r.unit,
      physicalMin: r.physical_min,
      physicalMax: r.physical_max,
      sortOrder: r.sort_order,
      icon: r.icon
    }));
  },

  adminUsers: async (_parent: unknown, _args: unknown, context: Context) => {
    requireAdmin(context.user);
    const users = await context.db.selectFrom("users").selectAll().orderBy("email", "asc").execute();
    const links = await context.db.selectFrom("user_sites").select(["user_id", "site_id"]).execute();
    const byUser = new Map<string, string[]>();
    for (const link of links) {
      const list = byUser.get(link.user_id) ?? [];
      list.push(link.site_id);
      byUser.set(link.user_id, list);
    }
    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      createdAt: u.created_at,
      assignedSiteIds: byUser.get(u.id) ?? []
    }));
  },

  adminSites: async (_parent: unknown, _args: unknown, context: Context) => {
    requireAdmin(context.user);
    const sites = await context.db.selectFrom("sites").selectAll().orderBy("name", "asc").execute();
    const batch = await getSitesSensorReportingBatch(
      context.db,
      sites.map((s) => s.id)
    );
    return sites.map((s) => ({
      id: s.id,
      name: s.name,
      location: s.location,
      latitude: s.latitude,
      longitude: s.longitude,
      sensorReporting: gqlSensorReporting(batch.get(s.id) ?? []),
      createdAt: s.created_at,
      updatedAt: s.updated_at
    }));
  }
};

export const adminMutations = {
  createAdminUser: async (
    _parent: unknown,
    args: { input: { email: string; password: string; name?: string | null; role: string; assignedSiteIds?: string[] | null } },
    context: Context
  ) => {
    requireAdmin(context.user);
    const email = args.input.email.trim().toLowerCase();
    const password = args.input.password;
    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }
    const role = parseRole(args.input.role);
    const rawName = args.input.name;
    const name = rawName === undefined || rawName === null || rawName.trim() === "" ? null : rawName.trim();

    const taken = await context.db.selectFrom("users").select("id").where("email", "=", email).executeTakeFirst();
    if (taken) {
      throw new Error("Email is already in use");
    }

    const password_hash = await bcrypt.hash(password, 12);
    const row = await context.db
      .insertInto("users")
      .values({
        email,
        name,
        password_hash,
        role
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    const siteIds = args.input.assignedSiteIds ?? [];
    if (siteIds.length > 0) {
      const valid = await context.db.selectFrom("sites").select("id").where("id", "in", siteIds).execute();
      if (valid.length !== siteIds.length) {
        throw new Error("One or more site IDs are invalid");
      }
      await replaceUserSiteAssignments(context.db, row.id, siteIds);
    }

    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      createdAt: row.created_at,
      assignedSiteIds: siteIds
    };
  },

  updateAdminUser: async (
    _parent: unknown,
    args: {
      input: {
        id: string;
        email?: string | null;
        name?: string | null;
        role?: string | null;
        password?: string | null;
        assignedSiteIds?: string[] | null;
      };
    },
    context: Context
  ) => {
    requireAdmin(context.user);
    const input = args.input;
    const existing = await context.db.selectFrom("users").selectAll().where("id", "=", input.id).executeTakeFirst();
    if (!existing) {
      throw new Error("User not found");
    }

    const patch: Record<string, unknown> = {};

    if (input.email !== undefined && input.email !== null) {
      const email = input.email.trim().toLowerCase();
      if (email !== existing.email) {
        const taken = await context.db
          .selectFrom("users")
          .select("id")
          .where("email", "=", email)
          .where("id", "!=", input.id)
          .executeTakeFirst();
        if (taken) {
          throw new Error("Email is already in use");
        }
      }
      patch.email = email;
    }

    if (input.name !== undefined) {
      patch.name = input.name === null || input.name.trim() === "" ? null : input.name.trim();
    }

    if (input.role !== undefined && input.role !== null) {
      const nextRole = parseRole(input.role);
      await assertCanChangeAdminRole(context.db, input.id, existing.role === "admin", nextRole === "admin");
      patch.role = nextRole;
    }

    if (input.password !== undefined && input.password !== null && input.password.trim() !== "") {
      if (input.password.length < 8) {
        throw new Error("Password must be at least 8 characters");
      }
      patch.password_hash = await bcrypt.hash(input.password, 12);
    }

    if (Object.keys(patch).length > 0) {
      patch.updated_at = new Date();
      await context.db.updateTable("users").set(patch as never).where("id", "=", input.id).execute();
    }

    if (input.assignedSiteIds !== undefined && input.assignedSiteIds !== null) {
      const siteIds = input.assignedSiteIds;
      if (siteIds.length > 0) {
        const valid = await context.db.selectFrom("sites").select("id").where("id", "in", siteIds).execute();
        if (valid.length !== siteIds.length) {
          throw new Error("One or more site IDs are invalid");
        }
      }
      await replaceUserSiteAssignments(context.db, input.id, siteIds);
    }

    const row = await context.db.selectFrom("users").selectAll().where("id", "=", input.id).executeTakeFirstOrThrow();
    const assigned = await context.db.selectFrom("user_sites").select("site_id").where("user_id", "=", input.id).execute();

    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      createdAt: row.created_at,
      assignedSiteIds: assigned.map((a) => a.site_id)
    };
  },

  resetAdminUserPassword: async (
    _parent: unknown,
    args: { id: string; newPassword: string },
    context: Context
  ) => {
    requireAdmin(context.user);
    const newPassword = args.newPassword;
    if (newPassword.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }
    const existing = await context.db.selectFrom("users").select("id").where("id", "=", args.id).executeTakeFirst();
    if (!existing) {
      throw new Error("User not found");
    }
    await context.db
      .updateTable("users")
      .set({
        password_hash: await bcrypt.hash(newPassword, 12),
        updated_at: new Date()
      })
      .where("id", "=", args.id)
      .execute();
    const row = await context.db.selectFrom("users").selectAll().where("id", "=", args.id).executeTakeFirstOrThrow();
    const assigned = await context.db.selectFrom("user_sites").select("site_id").where("user_id", "=", args.id).execute();
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      createdAt: row.created_at,
      assignedSiteIds: assigned.map((a) => a.site_id)
    };
  },

  createAdminSite: async (
    _parent: unknown,
    args: {
      input: {
        name: string;
        location?: string | null;
        latitude?: number | null;
        longitude?: number | null;
        sensorReporting?: { key: string; enabled: boolean }[] | null;
        sensorThresholds?: { key: string; minValue?: number | null; maxValue?: number | null }[] | null;
        deviceId?: string | null;
      };
    },
    context: Context
  ) => {
    requireAdmin(context.user);
    const name = args.input.name.trim();
    if (!name) {
      throw new Error("Site name is required");
    }
    const loc = args.input.location;
    const location = loc === undefined || loc === null || loc.trim() === "" ? null : loc.trim();

    const { latitude, longitude } = normalizeCoordinates(args.input.latitude, args.input.longitude);

    const row = await context.db.transaction().execute(async (trx) => {
      const site = await trx
        .insertInto("sites")
        .values({ name, location, latitude, longitude })
        .returningAll()
        .executeTakeFirstOrThrow();

      await ensureSiteSensorRowsForNewSite(trx, site.id, true);

      if (args.input.sensorReporting != null && args.input.sensorReporting.length > 0) {
        await replaceSiteSensorReporting(
          trx,
          site.id,
          args.input.sensorReporting.map((r) => ({ key: r.key, enabled: r.enabled }))
        );
      }

      if (args.input.sensorThresholds != null && args.input.sensorThresholds.length > 0) {
        await replaceSiteSensorThresholds(
          trx,
          site.id,
          args.input.sensorThresholds.map((r) => ({
            key: r.key,
            minValue: r.minValue ?? null,
            maxValue: r.maxValue ?? null
          }))
        );
      }

      if (args.input.deviceId) {
        await trx.updateTable("devices").set({ site_id: site.id, updated_at: new Date() }).where("id", "=", args.input.deviceId).execute();
      }

      return site;
    });

    const sensorReporting = await getSiteSensorReportingForGraphql(context.db, row.id);

    return {
      id: row.id,
      name: row.name,
      location: row.location,
      latitude: row.latitude,
      longitude: row.longitude,
      sensorReporting: gqlSensorReporting(sensorReporting),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  },

  updateAdminSite: async (
    _parent: unknown,
    args: {
      input: {
        id: string;
        name: string;
        location?: string | null;
        latitude?: number | null;
        longitude?: number | null;
        sensorReporting?: { key: string; enabled: boolean }[] | null;
        sensorThresholds?: { key: string; minValue?: number | null; maxValue?: number | null }[] | null;
        deviceId?: string | null;
      };
    },
    context: Context
  ) => {
    requireAdmin(context.user);
    const name = args.input.name.trim();
    if (!name) {
      throw new Error("Site name is required");
    }
    const loc = args.input.location;
    const location = loc === undefined || loc === null || loc.trim() === "" ? null : loc.trim();

    const existing = await context.db.selectFrom("sites").selectAll().where("id", "=", args.input.id).executeTakeFirst();
    if (!existing) {
      throw new Error("Site not found");
    }

    const patch: Record<string, unknown> = { name, location, updated_at: new Date() };

    const hasLat = Object.prototype.hasOwnProperty.call(args.input, "latitude");
    const hasLng = Object.prototype.hasOwnProperty.call(args.input, "longitude");
    if (hasLat || hasLng) {
      if (hasLat !== hasLng) {
        throw new Error("Provide both latitude and longitude or omit both");
      }
      const coords = normalizeCoordinates(args.input.latitude, args.input.longitude);
      patch.latitude = coords.latitude;
      patch.longitude = coords.longitude;
    }

    if (Object.prototype.hasOwnProperty.call(args.input, "sensorReporting") && args.input.sensorReporting != null) {
      const before = await context.db
        .selectFrom("site_sensor_catalog")
        .innerJoin("sensor_catalog", "sensor_catalog.id", "site_sensor_catalog.sensor_catalog_id")
        .select(["sensor_catalog.key", "site_sensor_catalog.enabled"])
        .where("site_sensor_catalog.site_id", "=", args.input.id)
        .execute();
      const beforeMap: Record<string, boolean> = {};
      for (const r of before) {
        beforeMap[r.key] = r.enabled;
      }

      await replaceSiteSensorReporting(
        context.db,
        args.input.id,
        args.input.sensorReporting.map((r) => ({ key: r.key, enabled: r.enabled }))
      );

      const after = await context.db
        .selectFrom("site_sensor_catalog")
        .innerJoin("sensor_catalog", "sensor_catalog.id", "site_sensor_catalog.sensor_catalog_id")
        .select(["sensor_catalog.key", "site_sensor_catalog.enabled"])
        .where("site_sensor_catalog.site_id", "=", args.input.id)
        .execute();
      const afterMap: Record<string, boolean> = {};
      for (const r of after) {
        afterMap[r.key] = r.enabled;
      }

      for (const key of Object.keys(beforeMap)) {
        if (beforeMap[key] && !afterMap[key]) {
          await resolveActiveAlertsForTypes(context.db, args.input.id, alertTypesForSensorKey(key));
        }
      }
    }

    if (Object.prototype.hasOwnProperty.call(args.input, "sensorThresholds") && args.input.sensorThresholds != null) {
      await replaceSiteSensorThresholds(
        context.db,
        args.input.id,
        args.input.sensorThresholds.map((r) => ({
          key: r.key,
          minValue: r.minValue ?? null,
          maxValue: r.maxValue ?? null
        }))
      );
    }

    await context.db.updateTable("sites").set(patch as never).where("id", "=", args.input.id).execute();

    if (Object.prototype.hasOwnProperty.call(args.input, "deviceId")) {
      await context.db.transaction().execute(async (trx) => {
        await trx.updateTable("devices").set({ site_id: null, updated_at: new Date() }).where("site_id", "=", args.input.id).execute();
        if (args.input.deviceId) {
          await trx.updateTable("devices").set({ site_id: args.input.id, updated_at: new Date() }).where("id", "=", args.input.deviceId).execute();
        }
      });
    }

    const row = await context.db.selectFrom("sites").selectAll().where("id", "=", args.input.id).executeTakeFirstOrThrow();
    const sensorReporting = await getSiteSensorReportingForGraphql(context.db, row.id);

    return {
      id: row.id,
      name: row.name,
      location: row.location,
      latitude: row.latitude,
      longitude: row.longitude,
      sensorReporting: gqlSensorReporting(sensorReporting),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  },

  createSensorCatalogEntry: async (
    _parent: unknown,
    args: {
      input: {
        key: string;
        displayName: string;
        unit: string;
        physicalMin?: number | null;
        physicalMax?: number | null;
        sortOrder?: number | null;
        icon?: string | null;
      };
    },
    context: Context
  ) => {
    requireAdmin(context.user);
    const input = args.input;
    try {
      const row = await createSensorCatalogEntry(context.db, {
        key: input.key,
        display_name: input.displayName,
        unit: input.unit,
        physical_min: input.physicalMin ?? null,
        physical_max: input.physicalMax ?? null,
        sort_order: input.sortOrder ?? undefined,
        icon: input.icon ?? null
      });
      return {
        id: row.id,
        key: row.key,
        displayName: row.display_name,
        unit: row.unit,
        physicalMin: row.physical_min,
        physicalMax: row.physical_max,
        sortOrder: row.sort_order,
        icon: row.icon
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("duplicate key") || msg.includes("unique constraint")) {
        throw new Error(`A sensor with key "${input.key.trim()}" already exists`);
      }
      throw e;
    }
  },

  updateSensorCatalogEntry: async (
    _parent: unknown,
    args: {
      input: {
        id: string;
        displayName?: string | null;
        unit?: string | null;
        physicalMin?: number | null;
        physicalMax?: number | null;
        sortOrder?: number | null;
        icon?: string | null;
      };
    },
    context: Context
  ) => {
    requireAdmin(context.user);
    const input = args.input;
    const patch: {
      display_name?: string;
      unit?: string;
      physical_min?: number | null;
      physical_max?: number | null;
      sort_order?: number;
      icon?: string | null;
    } = {};
    if (Object.prototype.hasOwnProperty.call(input, "displayName")) {
      if (input.displayName == null) {
        throw new Error("Display name cannot be null");
      }
      patch.display_name = input.displayName;
    }
    if (Object.prototype.hasOwnProperty.call(input, "unit")) {
      if (input.unit == null) {
        throw new Error("Unit cannot be null");
      }
      patch.unit = input.unit;
    }
    if (Object.prototype.hasOwnProperty.call(input, "physicalMin")) {
      patch.physical_min = input.physicalMin ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(input, "physicalMax")) {
      patch.physical_max = input.physicalMax ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(input, "sortOrder")) {
      if (input.sortOrder != null && Number.isFinite(input.sortOrder)) {
        patch.sort_order = Math.trunc(input.sortOrder);
      }
    }
    if (Object.prototype.hasOwnProperty.call(input, "icon")) {
      patch.icon = input.icon ?? null;
    }
    const row = await updateSensorCatalogEntry(context.db, input.id, patch);
    return {
      id: row.id,
      key: row.key,
      displayName: row.display_name,
      unit: row.unit,
      physicalMin: row.physical_min,
      physicalMax: row.physical_max,
      sortOrder: row.sort_order,
      icon: row.icon
    };
  },

  deleteSensorCatalogEntry: async (_parent: unknown, args: { id: string }, context: Context) => {
    requireAdmin(context.user);
    const row = await context.db
      .selectFrom("sensor_catalog")
      .select(["id", "key"])
      .where("id", "=", args.id)
      .executeTakeFirst();
    if (!row) {
      throw new Error("Sensor not found");
    }
    const sites = await context.db.selectFrom("sites").select("id").execute();
    const types = alertTypesForSensorKey(row.key);
    for (const s of sites) {
      await resolveActiveAlertsForTypes(context.db, s.id, types);
    }
    await context.db.deleteFrom("sensor_thresholds").where("sensor", "=", row.key).execute();
    await context.db.deleteFrom("sensor_catalog").where("id", "=", args.id).execute();
    return true;
  }
};

import { createHash, randomBytes } from "node:crypto";
import type { DevicePinMap } from "@app/db/types";
import type { Context } from "../../context.js";
import { requireAdmin } from "../../rbac.js";

function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function generateApiKey() {
  return `ud_${randomBytes(24).toString("base64url")}`;
}

type DeviceRow = {
  id: string;
  device_id: string;
  name: string | null;
  site_id: string;
  board: string | null;
  pin_map: DevicePinMap | null;
  expected_interval_seconds: number;
  last_seen_at: Date | null;
  created_at: Date;
};

async function loadSiteName(db: Context["db"], siteId: string): Promise<string> {
  const row = await db
    .selectFrom("sites")
    .select(["name"])
    .where("id", "=", siteId)
    .executeTakeFirst();
  return row?.name ?? "";
}

function toAdminDevice(row: DeviceRow, siteName: string) {
  return {
    id: row.id,
    deviceId: row.device_id,
    name: row.name,
    siteId: row.site_id,
    siteName,
    board: row.board,
    pinMap: row.pin_map,
    expectedIntervalSeconds: row.expected_interval_seconds,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at
  };
}

async function loadDeviceOrThrow(db: Context["db"], id: string): Promise<DeviceRow> {
  const row = await db
    .selectFrom("devices")
    .select([
      "id",
      "device_id",
      "name",
      "site_id",
      "board",
      "pin_map",
      "expected_interval_seconds",
      "last_seen_at",
      "created_at"
    ])
    .where("id", "=", id)
    .executeTakeFirst();
  if (!row) {
    throw new Error("Device not found");
  }
  return row as DeviceRow;
}

export const deviceQueries = {
  adminDevices: async (
    _parent: unknown,
    args: { siteId?: string | null },
    context: Context
  ) => {
    requireAdmin(context.user);

    let q = context.db
      .selectFrom("devices")
      .innerJoin("sites", "sites.id", "devices.site_id")
      .select([
        "devices.id as id",
        "devices.device_id as device_id",
        "devices.name as name",
        "devices.site_id as site_id",
        "devices.board as board",
        "devices.pin_map as pin_map",
        "devices.expected_interval_seconds as expected_interval_seconds",
        "devices.last_seen_at as last_seen_at",
        "devices.created_at as created_at",
        "sites.name as site_name"
      ])
      .orderBy("sites.name")
      .orderBy("devices.device_id");

    if (args.siteId) {
      q = q.where("devices.site_id", "=", args.siteId);
    }

    const rows = await q.execute();
    return rows.map((r) =>
      toAdminDevice(
        {
          id: r.id,
          device_id: r.device_id,
          name: r.name,
          site_id: r.site_id,
          board: r.board,
          pin_map: r.pin_map as DevicePinMap | null,
          expected_interval_seconds: r.expected_interval_seconds,
          last_seen_at: r.last_seen_at,
          created_at: r.created_at
        },
        r.site_name
      )
    );
  },

  adminDevice: async (_parent: unknown, args: { id: string }, context: Context) => {
    requireAdmin(context.user);
    const device = await loadDeviceOrThrow(context.db, args.id);
    const siteName = await loadSiteName(context.db, device.site_id);
    return toAdminDevice(device, siteName);
  }
};

export const deviceMutations = {
  createAdminDevice: async (
    _parent: unknown,
    args: {
      input: {
        siteId: string;
        deviceId: string;
        name?: string | null;
        board?: string | null;
        expectedIntervalSeconds?: number | null;
      };
    },
    context: Context
  ) => {
    requireAdmin(context.user);

    const deviceId = args.input.deviceId.trim();
    if (!deviceId) {
      throw new Error("deviceId is required");
    }
    if (deviceId.length > 128) {
      throw new Error("deviceId is too long");
    }

    const site = await context.db
      .selectFrom("sites")
      .select(["id", "name"])
      .where("id", "=", args.input.siteId)
      .executeTakeFirst();
    if (!site) {
      throw new Error("Site not found");
    }

    const taken = await context.db
      .selectFrom("devices")
      .select("id")
      .where("device_id", "=", deviceId)
      .executeTakeFirst();
    if (taken) {
      throw new Error("A device with that ID already exists");
    }

    const apiKey = generateApiKey();
    const apiKeyHash = sha256Hex(apiKey);

    const trimmedName = args.input.name?.trim();
    const interval =
      args.input.expectedIntervalSeconds != null && Number.isFinite(args.input.expectedIntervalSeconds)
        ? Math.max(5, Math.trunc(args.input.expectedIntervalSeconds))
        : 300;

    const inserted = await context.db
      .insertInto("devices")
      .values({
        site_id: site.id,
        device_id: deviceId,
        api_key_hash: apiKeyHash,
        expected_interval_seconds: interval,
        name: trimmedName && trimmedName.length > 0 ? trimmedName : null,
        board: args.input.board ?? null,
        pin_map: null
      })
      .returning([
        "id",
        "device_id",
        "name",
        "site_id",
        "board",
        "pin_map",
        "expected_interval_seconds",
        "last_seen_at",
        "created_at"
      ])
      .executeTakeFirstOrThrow();

    return {
      device: toAdminDevice(inserted as DeviceRow, site.name),
      apiKey
    };
  },

  updateAdminDevice: async (
    _parent: unknown,
    args: {
      input: {
        id: string;
        deviceId?: string | null;
        name?: string | null;
        board?: string | null;
        expectedIntervalSeconds?: number | null;
        pinMap?: DevicePinMap | null;
      };
    },
    context: Context
  ) => {
    requireAdmin(context.user);
    const existing = await loadDeviceOrThrow(context.db, args.input.id);

    const patch: Record<string, unknown> = { updated_at: new Date() };

    if (args.input.deviceId !== undefined && args.input.deviceId !== null) {
      const next = args.input.deviceId.trim();
      if (!next) throw new Error("deviceId cannot be empty");
      if (next !== existing.device_id) {
        const taken = await context.db
          .selectFrom("devices")
          .select("id")
          .where("device_id", "=", next)
          .where("id", "!=", existing.id)
          .executeTakeFirst();
        if (taken) throw new Error("A device with that ID already exists");
        patch.device_id = next;
      }
    }

    if (args.input.name !== undefined) {
      const v = args.input.name?.trim();
      patch.name = v && v.length > 0 ? v : null;
    }

    if (args.input.board !== undefined) {
      patch.board = args.input.board ?? null;
    }

    if (
      args.input.expectedIntervalSeconds !== undefined &&
      args.input.expectedIntervalSeconds !== null &&
      Number.isFinite(args.input.expectedIntervalSeconds)
    ) {
      patch.expected_interval_seconds = Math.max(5, Math.trunc(args.input.expectedIntervalSeconds));
    }

    if (Object.prototype.hasOwnProperty.call(args.input, "pinMap")) {
      patch.pin_map = args.input.pinMap ?? null;
    }

    await context.db.updateTable("devices").set(patch as never).where("id", "=", existing.id).execute();

    const fresh = await loadDeviceOrThrow(context.db, existing.id);
    const siteName = await loadSiteName(context.db, fresh.site_id);
    return toAdminDevice(fresh, siteName);
  },

  rotateAdminDeviceApiKey: async (
    _parent: unknown,
    args: { id: string },
    context: Context
  ) => {
    requireAdmin(context.user);
    const existing = await loadDeviceOrThrow(context.db, args.id);
    const apiKey = generateApiKey();
    await context.db
      .updateTable("devices")
      .set({ api_key_hash: sha256Hex(apiKey), updated_at: new Date() })
      .where("id", "=", existing.id)
      .execute();
    return apiKey;
  },

  deleteAdminDevice: async (_parent: unknown, args: { id: string }, context: Context) => {
    requireAdmin(context.user);
    await loadDeviceOrThrow(context.db, args.id);
    await context.db.deleteFrom("devices").where("id", "=", args.id).execute();
    return true;
  }
};

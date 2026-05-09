import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<unknown>) {
  await db.schema
    .createTable("sites")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("location", "text")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable("devices")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("site_id", "uuid", (col) => col.notNull().references("sites.id").onDelete("cascade"))
    .addColumn("device_id", "text", (col) => col.notNull().unique())
    .addColumn("api_key_hash", "text", (col) => col.notNull().unique())
    .addColumn("expected_interval_seconds", "integer", (col) => col.notNull().defaultTo(300))
    .addColumn("last_seen_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable("user_sites")
    .addColumn("user_id", "uuid", (col) => col.notNull().references("users.id").onDelete("cascade"))
    .addColumn("site_id", "uuid", (col) => col.notNull().references("sites.id").onDelete("cascade"))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint("user_sites_pk", ["user_id", "site_id"])
    .execute();

  await db.schema
    .createTable("sensor_thresholds")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("site_id", "uuid", (col) => col.notNull().references("sites.id").onDelete("cascade"))
    .addColumn("sensor", "text", (col) =>
      col.notNull().check(sql`sensor in ('temperature', 'ph', 'waterLevel', 'dissolvedOxygen')`)
    )
    .addColumn("min_value", "double precision")
    .addColumn("max_value", "double precision")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addUniqueConstraint("sensor_thresholds_site_sensor_unique", ["site_id", "sensor"])
    .execute();

  await db.schema.createIndex("devices_site_id_idx").on("devices").column("site_id").execute();
  await db.schema.createIndex("user_sites_site_id_idx").on("user_sites").column("site_id").execute();
}

export async function down(db: Kysely<unknown>) {
  await db.schema.dropTable("sensor_thresholds").ifExists().execute();
  await db.schema.dropTable("user_sites").ifExists().execute();
  await db.schema.dropTable("devices").ifExists().execute();
  await db.schema.dropTable("sites").ifExists().execute();
}

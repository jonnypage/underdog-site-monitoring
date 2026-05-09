import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<unknown>) {
  await db.schema
    .createTable("sensor_catalog")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("key", "text", (col) => col.notNull().unique())
    .addColumn("display_name", "text", (col) => col.notNull())
    .addColumn("unit", "text", (col) => col.notNull())
    .addColumn("physical_min", "double precision")
    .addColumn("physical_max", "double precision")
    .addColumn("sort_order", "integer", (col) => col.notNull().defaultTo(0))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable("site_sensor_catalog")
    .addColumn("site_id", "uuid", (col) => col.notNull().references("sites.id").onDelete("cascade"))
    .addColumn("sensor_catalog_id", "uuid", (col) =>
      col.notNull().references("sensor_catalog.id").onDelete("cascade")
    )
    .addColumn("enabled", "boolean", (col) => col.notNull().defaultTo(true))
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint("site_sensor_catalog_pk", ["site_id", "sensor_catalog_id"])
    .execute();

  await db.schema.createIndex("site_sensor_catalog_site_idx").on("site_sensor_catalog").column("site_id").execute();

  await sql`
    INSERT INTO sensor_catalog (key, display_name, unit, physical_min, physical_max, sort_order)
    VALUES
      ('temperature', 'Temperature', '°C', -5, 45, 1),
      ('ph', 'pH', 'pH', 0, 14, 2),
      ('waterLevel', 'Water level', '%', 0, 100, 3),
      ('dissolvedOxygen', 'Dissolved oxygen', 'mg/L', 0, 20, 4)
  `.execute(db);

  await sql`
    INSERT INTO site_sensor_catalog (site_id, sensor_catalog_id, enabled)
    SELECT s.id, c.id,
      CASE
        WHEN s.sensor_visibility IS NULL THEN true
        WHEN (s.sensor_visibility->>c.key)::boolean IS NULL THEN true
        ELSE (s.sensor_visibility->>c.key)::boolean
      END
    FROM sites s
    CROSS JOIN sensor_catalog c
  `.execute(db);

  await db.schema.alterTable("sites").dropColumn("sensor_visibility").execute();
}

export async function down(db: Kysely<unknown>) {
  await db.schema.alterTable("sites").addColumn("sensor_visibility", "jsonb").execute();

  await sql`
    UPDATE sites s
    SET sensor_visibility = sub.j
    FROM (
      SELECT site_id,
        jsonb_object_agg(key, enabled) AS j
      FROM site_sensor_catalog
      JOIN sensor_catalog ON sensor_catalog.id = site_sensor_catalog.sensor_catalog_id
      GROUP BY site_id
    ) sub
    WHERE s.id = sub.site_id
  `.execute(db);

  await db.schema.dropIndex("site_sensor_catalog_site_idx").execute();
  await db.schema.dropTable("site_sensor_catalog").execute();
  await db.schema.dropTable("sensor_catalog").execute();
}

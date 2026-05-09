import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<unknown>) {
  await db.schema
    .createTable("measurements")
    .addColumn("id", "bigserial", (col) => col.notNull())
    .addColumn("site_id", "uuid", (col) => col.notNull().references("sites.id").onDelete("cascade"))
    .addColumn("device_id", "uuid", (col) => col.references("devices.id").onDelete("set null"))
    .addColumn("sensor", "text", (col) =>
      col.notNull().check(sql`sensor in ('temperature', 'ph', 'waterLevel', 'dissolvedOxygen')`)
    )
    .addColumn("value", "double precision", (col) => col.notNull())
    .addColumn("taken_at", "timestamptz", (col) => col.notNull())
    .addColumn("ingested_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint("measurements_taken_at_id_pk", ["taken_at", "id"])
    .execute();

  await sql`
    create index measurements_site_sensor_taken_at_idx
    on measurements (site_id, sensor, taken_at desc)
  `.execute(db);

  await sql`
    create index measurements_device_taken_at_idx
    on measurements (device_id, taken_at desc)
  `.execute(db);
}

export async function down(db: Kysely<unknown>) {
  await db.schema.dropTable("measurements").ifExists().execute();
}

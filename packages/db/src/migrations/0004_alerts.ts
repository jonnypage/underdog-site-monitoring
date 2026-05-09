import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<unknown>) {
  await db.schema
    .createTable("alerts")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("site_id", "uuid", (col) => col.notNull().references("sites.id").onDelete("cascade"))
    .addColumn("device_id", "uuid", (col) => col.references("devices.id").onDelete("set null"))
    .addColumn("type", "text", (col) => col.notNull())
    .addColumn("message", "text", (col) => col.notNull())
    .addColumn("severity", "text", (col) =>
      col.notNull().check(sql`severity in ('info', 'warning', 'critical')`)
    )
    .addColumn("status", "text", (col) =>
      col.notNull().defaultTo("active").check(sql`status in ('active', 'resolved')`)
    )
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("resolved_at", "timestamptz")
    .addColumn("last_notified_at", "timestamptz")
    .execute();

  await sql`
    create unique index alerts_active_site_type_unique
    on alerts (site_id, type)
    where status = 'active'
  `.execute(db);

  await sql`
    create index alerts_active_site_severity_idx
    on alerts (site_id, severity, created_at desc)
    where status = 'active'
  `.execute(db);
}

export async function down(db: Kysely<unknown>) {
  await db.schema.dropTable("alerts").ifExists().execute();
}

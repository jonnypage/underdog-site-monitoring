import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("sensor_catalog")
    .addColumn("icon", "varchar(64)", (col) => col.defaultTo(null))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("sensor_catalog").dropColumn("icon").execute();
}

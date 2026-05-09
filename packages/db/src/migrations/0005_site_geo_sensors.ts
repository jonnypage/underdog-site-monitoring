import { type Kysely } from "kysely";

export async function up(db: Kysely<unknown>) {
  await db.schema
    .alterTable("sites")
    .addColumn("latitude", "double precision")
    .addColumn("longitude", "double precision")
    .addColumn("sensor_visibility", "jsonb")
    .execute();
}

export async function down(db: Kysely<unknown>) {
  await db.schema.alterTable("sites").dropColumn("sensor_visibility").execute();
  await db.schema.alterTable("sites").dropColumn("longitude").execute();
  await db.schema.alterTable("sites").dropColumn("latitude").execute();
}

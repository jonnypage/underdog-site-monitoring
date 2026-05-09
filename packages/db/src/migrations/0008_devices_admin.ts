import { sql, type Kysely } from "kysely";

/**
 * Adds optional metadata columns to `devices` so the admin UI can manage
 * physical hardware (friendly name, board model, last sensor->GPIO mapping
 * recorded at install time). The `device_id` and `api_key_hash` contract on
 * /ingest is unchanged.
 */
export async function up(db: Kysely<unknown>) {
  await db.schema.alterTable("devices").addColumn("name", "text").execute();
  await db.schema.alterTable("devices").addColumn("board", "text").execute();
  await db.schema.alterTable("devices").addColumn("pin_map", "jsonb").execute();
}

export async function down(db: Kysely<unknown>) {
  await db.schema.alterTable("devices").dropColumn("pin_map").execute();
  await db.schema.alterTable("devices").dropColumn("board").execute();
  await db.schema.alterTable("devices").dropColumn("name").execute();
  // Reference sql to keep kysely's type import unused-warning silent if a
  // future revision needs raw SQL here.
  void sql;
}

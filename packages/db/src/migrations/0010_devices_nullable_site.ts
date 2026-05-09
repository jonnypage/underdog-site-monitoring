import { type Kysely } from "kysely";

export async function up(db: Kysely<unknown>) {
  await db.schema
    .alterTable("devices")
    .alterColumn("site_id", (col) => col.dropNotNull())
    .execute();
}

export async function down(db: Kysely<unknown>) {
  // Can't reliably restore NOT NULL if there are rows with NULL site_id.
  // This is a one-way change for existing data if we leave unassigned devices.
  // If we really needed to revert, we would have to delete or assign unassigned devices first.
  await db.schema
    .alterTable("devices")
    .alterColumn("site_id", (col) => col.setNotNull())
    .execute();
}

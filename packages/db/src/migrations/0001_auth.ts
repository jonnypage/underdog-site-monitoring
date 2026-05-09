import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<unknown>) {
  await sql`create extension if not exists "pgcrypto"`.execute(db);

  await db.schema
    .createTable("users")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("name", "text")
    .addColumn("email", "text", (col) => col.notNull().unique())
    .addColumn("emailVerified", "timestamptz")
    .addColumn("image", "text")
    .addColumn("password_hash", "text")
    .addColumn("role", "text", (col) =>
      col.notNull().defaultTo("site_viewer").check(sql`role in ('admin', 'site_manager', 'site_viewer')`)
    )
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable("accounts")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("userId", "uuid", (col) => col.notNull().references("users.id").onDelete("cascade"))
    .addColumn("type", "text", (col) => col.notNull())
    .addColumn("provider", "text", (col) => col.notNull())
    .addColumn("providerAccountId", "text", (col) => col.notNull())
    .addColumn("refresh_token", "text")
    .addColumn("access_token", "text")
    .addColumn("expires_at", "integer")
    .addColumn("token_type", "text")
    .addColumn("scope", "text")
    .addColumn("id_token", "text")
    .addColumn("session_state", "text")
    .addUniqueConstraint("accounts_provider_provider_account_id_unique", ["provider", "providerAccountId"])
    .execute();

  await db.schema
    .createTable("sessions")
    .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("sessionToken", "text", (col) => col.notNull().unique())
    .addColumn("userId", "uuid", (col) => col.notNull().references("users.id").onDelete("cascade"))
    .addColumn("expires", "timestamptz", (col) => col.notNull())
    .execute();

  await db.schema
    .createTable("verification_tokens")
    .addColumn("identifier", "text", (col) => col.notNull())
    .addColumn("token", "text", (col) => col.notNull())
    .addColumn("expires", "timestamptz", (col) => col.notNull())
    .addPrimaryKeyConstraint("verification_tokens_identifier_token_pk", ["identifier", "token"])
    .execute();
}

export async function down(db: Kysely<unknown>) {
  await db.schema.dropTable("verification_tokens").ifExists().execute();
  await db.schema.dropTable("sessions").ifExists().execute();
  await db.schema.dropTable("accounts").ifExists().execute();
  await db.schema.dropTable("users").ifExists().execute();
}

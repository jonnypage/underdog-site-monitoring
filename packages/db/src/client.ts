import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";
import type { Database } from "./types.js";

const { Pool } = pg;

export function createDb(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString: databaseUrl,
        ssl: databaseUrl.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined
      })
    })
  });
}

export type AppDb = ReturnType<typeof createDb>;

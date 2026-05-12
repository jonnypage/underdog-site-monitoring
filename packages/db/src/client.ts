import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";
import type { Database } from "./types.js";

const { Pool } = pg;

function poolMaxFromEnv(): number {
  const raw = process.env.PG_POOL_MAX;
  if (raw === undefined || raw === "") {
    return 10;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return 10;
  }
  return Math.min(32, Math.max(1, Math.floor(n)));
}

export function createDb(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const max = poolMaxFromEnv();

  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString: databaseUrl,
        ssl: databaseUrl.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined,
        max
      })
    })
  });
}

export type AppDb = ReturnType<typeof createDb>;

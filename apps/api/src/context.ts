import type { FastifyRequest } from "fastify";
import type { AppDb } from "@app/db";
import type { User } from "@app/db/types";
import { getUserFromSessionCookie } from "./auth/session.js";

export interface Context {
  db: AppDb;
  user: User | null;
}

export async function createContext(db: AppDb, request: FastifyRequest): Promise<Context> {
  return {
    db,
    user: await getUserFromSessionCookie(db, request.headers.cookie)
  };
}

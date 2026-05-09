import { getToken } from "next-auth/jwt";
import type { AppDb } from "@app/db";
import type { User } from "@app/db/types";

export async function getUserFromSessionCookie(db: AppDb, cookieHeader?: string): Promise<User | null> {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret || !cookieHeader) return null;

  const token = await getToken({
    req: { headers: { cookie: cookieHeader } } as { headers: { cookie: string } },
    secret
  });

  const userId = token?.sub;
  if (!userId || typeof userId !== "string") return null;

  const user = await db.selectFrom("users").selectAll().where("id", "=", userId).executeTakeFirst();
  return user ?? null;
}

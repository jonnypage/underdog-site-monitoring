import { getToken } from "next-auth/jwt";
import type { AppDb } from "@app/db";
import type { User } from "@app/db/types";

export async function getUserFromSessionCookie(db: AppDb, cookieHeader?: string): Promise<User | null> {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    console.error("Session debugging: AUTH_SECRET is not set.");
    return null;
  }
  if (!cookieHeader) {
    console.error("Session debugging: No cookie header received in the request.");
    return null;
  }

  // Try both possible cookie names just in case
  let token = await getToken({
    req: { headers: { cookie: cookieHeader } } as any,
    secret,
    cookieName: "__Secure-authjs.session-token"
  });

  if (!token) {
    token = await getToken({
      req: { headers: { cookie: cookieHeader } } as any,
      secret,
      cookieName: "authjs.session-token"
    });
  }

  if (!token) {
    console.error("Session debugging: No token returned from getToken. Check if AUTH_SECRET matches the web app.", { hasCookieHeader: !!cookieHeader });
  }

  const userId = token?.sub;
  if (!userId || typeof userId !== "string") return null;

  const user = await db.selectFrom("users").selectAll().where("id", "=", userId).executeTakeFirst();
  return user ?? null;
}

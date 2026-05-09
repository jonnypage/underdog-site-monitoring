import type { AppDb } from "@app/db";
import type { User, UserRole } from "@app/db/types";

const roleRank: Record<UserRole, number> = {
  site_viewer: 1,
  site_manager: 2,
  admin: 3
};

export function requireUser(user: User | null): User {
  if (!user) {
    throw new Error("Authentication required");
  }
  return user;
}

export function requireAdmin(user: User | null): User {
  const current = requireUser(user);
  if (current.role !== "admin") {
    throw new Error("Administrator access required");
  }
  return current;
}

export async function requireSiteAccess(db: AppDb, user: User | null, siteId: string, minRole: UserRole = "site_viewer") {
  const currentUser = requireUser(user);
  if (currentUser.role === "admin") return currentUser;

  if (roleRank[currentUser.role] < roleRank[minRole]) {
    throw new Error("Insufficient permissions");
  }

  const assignment = await db
    .selectFrom("user_sites")
    .select("site_id")
    .where("user_id", "=", currentUser.id)
    .where("site_id", "=", siteId)
    .executeTakeFirst();

  if (!assignment) {
    throw new Error("Site access denied");
  }

  return currentUser;
}

export function canWriteSite(user: User | null) {
  return user?.role === "admin" || user?.role === "site_manager";
}

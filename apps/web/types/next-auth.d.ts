import type { DefaultSession } from "next-auth";
import type { UserRole } from "@app/db/types";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & { id: string; role: UserRole };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: UserRole;
  }
}

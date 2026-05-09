import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { createDb } from "@app/db";
import type { UserRole } from "@app/db/types";

const db = process.env.DATABASE_URL ? createDb() : null;

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Credentials provider requires JWT sessions (database sessions are not supported for this flow).
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!db || !email || !password) return null;

        const user = await db.selectFrom("users").selectAll().where("email", "=", email).executeTakeFirst();
        if (!user?.password_hash) return null;

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: UserRole }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        if (token.sub) session.user.id = token.sub;
        if (typeof token.role === "string") {
          session.user.role = token.role as UserRole;
        }
      }
      return session;
    }
  },
  pages: {
    signIn: "/login"
  }
});

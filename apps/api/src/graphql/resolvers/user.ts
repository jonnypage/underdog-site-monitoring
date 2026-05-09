import bcrypt from "bcryptjs";
import type { Context } from "../../context.js";
import { requireUser } from "../../rbac.js";

export const userQueries = {
  getMe: async (_parent: unknown, _args: unknown, context: Context) => {
    const user = requireUser(context.user);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };
  }
};

export const userMutations = {
  updateMe: async (_parent: unknown, args: { input: { name?: string | null; email: string; currentPassword: string; newPassword?: string | null } }, context: Context) => {
    const sessionUser = requireUser(context.user);
    const row = await context.db.selectFrom("users").selectAll().where("id", "=", sessionUser.id).executeTakeFirstOrThrow();

    if (!row.password_hash) {
      throw new Error("Password login is not enabled for this account");
    }

    const currentOk = await bcrypt.compare(args.input.currentPassword, row.password_hash);
    if (!currentOk) {
      throw new Error("Current password is incorrect");
    }

    let passwordHash = row.password_hash;
    const newPw = args.input.newPassword?.trim();
    if (newPw) {
      if (newPw.length < 8) {
        throw new Error("New password must be at least 8 characters");
      }
      passwordHash = await bcrypt.hash(newPw, 12);
    }

    const newEmail = args.input.email.trim().toLowerCase();
    if (newEmail !== row.email) {
      const taken = await context.db.selectFrom("users").select("id").where("email", "=", newEmail).executeTakeFirst();
      if (taken) {
        throw new Error("Email is already in use");
      }
    }

    const rawName = args.input.name;
    const newName = rawName === undefined || rawName === null || rawName.trim() === "" ? null : rawName.trim();

    await context.db
      .updateTable("users")
      .set({
        name: newName,
        email: newEmail,
        password_hash: passwordHash,
        updated_at: new Date()
      })
      .where("id", "=", sessionUser.id)
      .execute();

    const updated = await context.db.selectFrom("users").selectAll().where("id", "=", sessionUser.id).executeTakeFirstOrThrow();

    return {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role
    };
  }
};

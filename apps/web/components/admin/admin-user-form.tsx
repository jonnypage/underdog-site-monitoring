"use client";

import { useMutation, useQuery } from "@apollo/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { apolloErrorMessage } from "@/lib/apollo-error-message";
import {
  AdminSitesDocument,
  AdminUsersDocument,
  CreateAdminUserDocument,
  ResetAdminUserPasswordDocument,
  UpdateAdminUserDocument
} from "@/lib/gql/generated/graphql";

const ROLES = ["admin", "site_manager", "site_viewer"] as const;

type Mode = "create" | "edit";

export function AdminUserForm({ mode, userId }: { mode: Mode; userId?: string }) {
  const router = useRouter();
  const { data: usersData, loading: usersLoading } = useQuery(AdminUsersDocument);
  const { data: sitesData } = useQuery(AdminSitesDocument);
  const [createUser, { loading: creatingUser }] = useMutation(CreateAdminUserDocument);
  const [updateUser, { loading: updatingUser }] = useMutation(UpdateAdminUserDocument);
  const [resetPassword, { loading: resettingPassword }] = useMutation(ResetAdminUserPasswordDocument);

  const users = usersData?.adminUsers ?? [];
  const sites = sitesData?.adminSites ?? [];
  const existing = mode === "edit" && userId ? users.find((u) => u.id === userId) : undefined;

  const [uEmail, setUEmail] = useState("");
  const [uPassword, setUPassword] = useState("");
  const [resetPass, setResetPass] = useState("");
  const [resetPassConfirm, setResetPassConfirm] = useState("");
  const [uName, setUName] = useState("");
  const [uRole, setURole] = useState<string>("site_viewer");
  const [uSiteIds, setUSiteIds] = useState<string[]>([]);
  const [userErr, setUserErr] = useState<string | null>(null);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(mode === "create");

  useEffect(() => {
    if (mode !== "edit" || !existing) return;
    setUEmail(existing.email);
    setUPassword("");
    setResetPass("");
    setResetPassConfirm("");
    setUName(existing.name ?? "");
    setURole(existing.role);
    setUSiteIds([...existing.assignedSiteIds]);
    setHydrated(true);
  }, [mode, existing]);

  function toggleUserSite(siteId: string) {
    setUSiteIds((prev) => (prev.includes(siteId) ? prev.filter((id) => id !== siteId) : [...prev, siteId]));
  }

  async function submitUser(event: React.FormEvent) {
    event.preventDefault();
    setUserErr(null);
    try {
      if (mode === "create") {
        await createUser({
          variables: {
            input: {
              email: uEmail.trim(),
              password: uPassword,
              name: uName.trim() === "" ? null : uName.trim(),
              role: uRole,
              assignedSiteIds: uSiteIds.length ? uSiteIds : undefined
            }
          }
        });
      } else if (mode === "edit" && userId) {
        await updateUser({
          variables: {
            input: {
              id: userId,
              email: uEmail.trim(),
              name: uName.trim() === "" ? null : uName.trim(),
              role: uRole,
              assignedSiteIds: uSiteIds
            }
          }
        });
      }
      router.push("/admin");
      router.refresh();
    } catch (err) {
      setUserErr(apolloErrorMessage(err));
    }
  }

  async function submitPasswordReset(event: React.FormEvent) {
    event.preventDefault();
    if (mode !== "edit" || !userId) return;
    setUserErr(null);
    setResetMsg(null);
    if (resetPass !== resetPassConfirm) {
      setUserErr("New password and confirmation do not match.");
      return;
    }
    if (resetPass.length < 8) {
      setUserErr("Password must be at least 8 characters.");
      return;
    }
    try {
      await resetPassword({ variables: { id: userId, newPassword: resetPass } });
      setResetPass("");
      setResetPassConfirm("");
      setResetMsg("Password was reset. Share the new password with the user securely.");
    } catch (err) {
      setUserErr(apolloErrorMessage(err));
    }
  }

  if (mode === "edit") {
    if (usersLoading || !usersData) {
      return <p className="text-sm text-muted-foreground">Loading user…</p>;
    }
    if (!existing) {
      return (
        <div className="space-y-4">
          <p className="text-sm text-red-600">User not found.</p>
          <Button type="button" variant="outline" asChild>
            <Link href="/admin">Back to admin</Link>
          </Button>
        </div>
      );
    }
    if (!hydrated) {
      return <p className="text-sm text-muted-foreground">Loading user…</p>;
    }
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>{mode === "create" ? "New user" : "Edit user"}</CardTitle>
        <p className="text-sm text-muted-foreground">
          <Link className="text-primary underline" href="/admin">
            ← Back to admin
          </Link>
        </p>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submitUser}>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="admin-u-email">
              Email
            </label>
            <Input id="admin-u-email" type="email" autoComplete="off" required value={uEmail} onChange={(e) => setUEmail(e.target.value)} />
          </div>
          {mode === "create" ? (
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="admin-u-password">
                Password
              </label>
              <Input
                id="admin-u-password"
                type="password"
                autoComplete="new-password"
                required
                value={uPassword}
                onChange={(e) => setUPassword(e.target.value)}
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="admin-u-name">
              Name
            </label>
            <Input id="admin-u-name" type="text" value={uName} onChange={(e) => setUName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="admin-u-role">
              Role
            </label>
            <Select id="admin-u-role" className="w-full" value={uRole} onChange={(e) => setURole(e.target.value)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Site access</p>
            <p className="text-xs text-muted-foreground">Admins see every site; assignments apply to managers and viewers.</p>
            <ul className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-border p-3">
              {sites.length === 0 ? <li className="text-sm text-muted-foreground">No sites yet. Create a site first.</li> : null}
              {sites.map((s) => (
                <li key={s.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    id={`site-${s.id}`}
                    checked={uSiteIds.includes(s.id)}
                    onChange={() => toggleUserSite(s.id)}
                    className="rounded border-border"
                  />
                  <label htmlFor={`site-${s.id}`} className="cursor-pointer">
                    {s.name}
                  </label>
                </li>
              ))}
            </ul>
          </div>
          {userErr ? <p className="text-sm text-red-600">{userErr}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={creatingUser || updatingUser}>
              {mode === "create" ? (creatingUser ? "Creating…" : "Create user") : updatingUser ? "Saving…" : "Save user"}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/admin">Cancel</Link>
            </Button>
          </div>
        </form>
        {mode === "edit" && userId ? (
          <form className="mt-8 space-y-4 border-t border-border pt-6" onSubmit={submitPasswordReset}>
            <div>
              <h3 className="text-sm font-semibold">Reset password</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Admin-only: set a new password without knowing the current one. Existing sessions stay valid until they expire.
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="admin-reset-pass">
                New password
              </label>
              <Input
                id="admin-reset-pass"
                type="password"
                autoComplete="new-password"
                value={resetPass}
                onChange={(e) => setResetPass(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="admin-reset-pass-confirm">
                Confirm new password
              </label>
              <Input
                id="admin-reset-pass-confirm"
                type="password"
                autoComplete="new-password"
                value={resetPassConfirm}
                onChange={(e) => setResetPassConfirm(e.target.value)}
              />
            </div>
            {resetMsg ? <p className="text-sm text-emerald-700 dark:text-emerald-400">{resetMsg}</p> : null}
            <Button type="submit" variant="outline" disabled={resettingPassword}>
              {resettingPassword ? "Resetting…" : "Reset password"}
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}

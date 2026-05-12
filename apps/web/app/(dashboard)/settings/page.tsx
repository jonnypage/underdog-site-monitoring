"use client";

import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LoadingMessage, Spinner } from "@/components/ui/spinner";
import { useGetMe, useUpdateMe } from "@/lib/useAPI";
import { roleDisplayName } from "@/lib/role-display-name";

function apolloErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "graphQLErrors" in err) {
    const gqlErrs = (err as { graphQLErrors?: { message: string }[] }).graphQLErrors;
    if (gqlErrs?.length) return gqlErrs.map((e) => e.message).join(" ");
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function SettingsPage() {
  const { data, loading, error } = useGetMe();
  const [updateMe, { loading: saving }] = useUpdateMe();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const me = data?.getMe;

  useEffect(() => {
    if (!me) return;
    setName(me.name ?? "");
    setEmail(me.email);
  }, [me]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Update your profile and sign-in credentials.</p>
      </div>
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <p className="text-sm text-muted-foreground">
            Role:{" "}
            {error
              ? "—"
              : loading
                ? (
                    <span className="inline-flex items-center gap-1.5 align-middle" aria-label="Loading role">
                      <Spinner size="xs" />
                    </span>
                  )
                : roleDisplayName(me?.role)}
          </p>
        </CardHeader>
        <CardContent>
          {loading ? <LoadingMessage>Loading profile...</LoadingMessage> : null}
          {error ? (
            <div className="mb-4 space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <p className="font-medium text-destructive">{apolloErrorMessage(error)}</p>
              {(error.message === "Failed to fetch" || apolloErrorMessage(error).includes("fetch")) && (
                <p className="text-muted-foreground">
                  The dashboard could not reach the API at <code className="rounded bg-muted px-1 py-0.5 text-xs">{apiBaseUrl}/graphql</code>.
                  Start the API (<code className="rounded bg-muted px-1 py-0.5 text-xs">pnpm dev</code> or the API service only), confirm{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">NEXT_PUBLIC_API_URL</code> in{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">apps/web/.env.local</code> matches that base URL, and ensure{" "}
                  <code className="rounded bg-muted px-1 py-0.5 text-xs">AUTH_SECRET</code> is identical on web and API so GraphQL can read your session.
                </p>
              )}
            </div>
          ) : null}
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              setFormError(null);
              if (newPassword || confirmPassword) {
                if (newPassword !== confirmPassword) {
                  setFormError("New password and confirmation do not match");
                  return;
                }
                if (newPassword.length < 8) {
                  setFormError("New password must be at least 8 characters");
                  return;
                }
              }
              try {
                await updateMe({
                  variables: {
                    input: {
                      name: name.trim() === "" ? null : name.trim(),
                      email: email.trim(),
                      currentPassword,
                      newPassword: newPassword.trim() === "" ? null : newPassword
                    }
                  }
                });
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
                await signOut({ callbackUrl: "/login?reason=profile-updated" });
              } catch (err) {
                setFormError(apolloErrorMessage(err));
              }
            }}
          >
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="name">
                Name
              </label>
              <Input id="name" name="name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="email">
                Email
              </label>
              <Input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="currentPassword">
                Current password
              </label>
              <Input
                id="currentPassword"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Required to save any changes.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="newPassword">
                New password
              </label>
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="confirmPassword">
                Confirm new password
              </label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
            <Button type="submit" disabled={saving || loading || !me} className="gap-2">
              {saving ? (
                <>
                  <Spinner className="text-primary-foreground" size="md" />
                  Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              After saving, you will be signed out and asked to sign in again so your session matches your updated account.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

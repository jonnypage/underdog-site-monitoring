"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { OrgLogo } from "@/components/org-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function LoginForm() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const profileUpdated = searchParams.get("reason") === "profile-updated";

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <OrgLogo variant="sidebar" />
          </div>
          <p className="text-center text-sm text-muted-foreground">Sign in with your email and password.</p>
        </CardHeader>
        <CardContent>
          {profileUpdated ? (
            <p className="mb-4 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              Your profile was updated. Sign in with your email and password.
            </p>
          ) : null}
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              setError(null);
              const formData = new FormData(event.currentTarget);
              const response = await signIn("credentials", {
                email: formData.get("email"),
                password: formData.get("password"),
                redirect: false,
                callbackUrl: "/sites"
              });
              if (response?.error) setError("Invalid email or password");
              else window.location.href = "/sites";
            }}
          >
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="email">
                Email
              </label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="password">
                Password
              </label>
              <Input id="password" name="password" type="password" autoComplete="current-password" required />
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button className="w-full" type="submit">
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
          <Card className="w-full max-w-md">
            <CardHeader className="space-y-4">
              <div className="flex justify-center">
                <OrgLogo variant="sidebar" />
              </div>
              <p className="text-center text-sm text-muted-foreground">Loading…</p>
            </CardHeader>
          </Card>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

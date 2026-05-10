"use client";

import Link from "next/link";
import { ChevronDown, LogOut, Settings, UserRound } from "lucide-react";
import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ThemeChoice = "light" | "dark" | "system";

export function DashboardUserMenu({ email }: { email: string | null }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    function handlePointerDown(event: MouseEvent | PointerEvent) {
      const el = rootRef.current;
      if (!el || el.contains(event.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-2"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <UserRound className="h-4 w-4 shrink-0" aria-hidden />
        <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} aria-hidden />
      </Button>
      {open ? (
        <div
          className="absolute right-0 z-20 mt-2 w-64 rounded-md border border-border bg-background py-1 shadow-lg"
          role="menu"
          aria-orientation="vertical"
        >
          <div className="border-b border-border px-3 py-2">
            <p className="text-xs text-muted-foreground">Signed in as</p>
            <p className="truncate text-sm font-medium">{email ?? "Unknown user"}</p>
          </div>
          <Link
            href="/settings"
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted"
            onClick={() => setOpen(false)}
          >
            <Settings className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            Settings
          </Link>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
            onClick={() => {
              setOpen(false);
              void signOut({ callbackUrl: "/login" });
            }}
          >
            <LogOut className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            Log out
          </button>
          <div className="border-t border-border px-3 py-2" role="group" aria-label="Theme">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Theme</p>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  { value: "light" as const, label: "Light" },
                  { value: "dark" as const, label: "Dark" },
                  { value: "system" as const, label: "System" }
                ] satisfies { value: ThemeChoice; label: string }[]
              ).map(({ value, label }) => (
                <Button
                  key={value}
                  type="button"
                  variant={theme === value ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setTheme(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import Link from "next/link";
import { Bell, MapPin, Shield } from "lucide-react";
import { useSession } from "next-auth/react";

const linkClass = "flex items-center gap-2 rounded-md px-3 py-2 hover:bg-muted";

type DashboardNavLinksProps = {
  /** Called after choosing a destination (e.g. close mobile drawer). */
  onNavigate?: () => void;
};

export function DashboardNavLinks({ onNavigate }: DashboardNavLinksProps) {
  const { data: session, status } = useSession();
  const isAdmin = status === "authenticated" && session?.user?.role === "admin";

  return (
    <nav className="space-y-1 text-sm" aria-label="Main">
      <Link className={linkClass} href="/sites" onClick={onNavigate}>
        <MapPin className="h-4 w-4 shrink-0" aria-hidden />
        Sites
      </Link>
      <Link className={linkClass} href="/alerts" onClick={onNavigate}>
        <Bell className="h-4 w-4 shrink-0" aria-hidden />
        Alerts
      </Link>
      {isAdmin ? (
        <Link className={linkClass} href="/admin" onClick={onNavigate}>
          <Shield className="h-4 w-4 shrink-0" aria-hidden />
          Admin
        </Link>
      ) : null}
    </nav>
  );
}

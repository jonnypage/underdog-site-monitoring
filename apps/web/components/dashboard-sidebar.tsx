"use client";

import { DashboardNavLinks } from "@/components/dashboard-nav-links";
import { OrgLogo } from "@/components/org-logo";

export function DashboardSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-border bg-background p-6 md:block">
      <div className="mb-8">
        <OrgLogo variant="sidebar" />
      </div>
      <DashboardNavLinks />
    </aside>
  );
}

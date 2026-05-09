"use client";

import { useQuery } from "@apollo/client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { SitesOverviewMap } from "@/components/sites/sites-overview-map";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteStatusBadge } from "@/components/site-status-badge";
import { GetSitesDocument } from "@/lib/gql/generated/graphql";

export default function SitesPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingSiteId, setPendingSiteId] = useState<string | null>(null);
  const { data, loading, error } = useQuery(GetSitesDocument);
  const sites = data?.getSites ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sites</h1>
        <p className="text-sm text-muted-foreground">Health across all assigned aquaponics sites.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Site List</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground">Loading sites...</p> : null}
          {error ? <p className="text-sm text-red-600">{error.message}</p> : null}
          <div className="flex flex-col text-sm">
            {/* Desktop Header */}
            <div className="hidden md:grid md:grid-cols-12 md:gap-4 border-b border-border py-3 text-left font-medium text-muted-foreground">
              <div className="col-span-6">Site</div>
              <div className="col-span-3">Status</div>
              <div className="col-span-3">Last update</div>
            </div>
            
            {/* Site Rows */}
            <div className="divide-y divide-border">
              {sites.map((site: any) => (
                <div key={site.id} className="grid grid-cols-1 gap-2 py-4 md:grid-cols-12 md:gap-4 md:py-3 md:items-center">
                  <div className="col-span-1 md:col-span-6">
                    <button
                      type="button"
                      className="inline-flex max-w-full items-center gap-2 text-left font-medium text-primary hover:underline disabled:cursor-wait disabled:opacity-70"
                      disabled={isPending}
                      onMouseEnter={() => router.prefetch(`/sites/${site.id}`)}
                      onClick={() => {
                        setPendingSiteId(site.id);
                        startTransition(() => {
                          router.push(`/sites/${site.id}`);
                        });
                      }}
                    >
                      {pendingSiteId === site.id && isPending ? (
                        <span
                          className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent"
                          aria-hidden
                        />
                      ) : null}
                      <span className="min-w-0 text-base md:text-sm truncate">{site.name}</span>
                    </button>
                  </div>
                  <div className="col-span-1 md:col-span-3 flex items-center gap-2">
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground md:hidden w-24">Status</span>
                    <SiteStatusBadge status={site.status} />
                  </div>
                  <div className="col-span-1 md:col-span-3 flex items-center gap-2">
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground md:hidden w-24">Updated</span>
                    <span className="text-muted-foreground md:text-foreground">
                      {site.lastUpdate ? new Date(site.lastUpdate).toLocaleString() : "No data yet"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Map</CardTitle>
          <p className="text-sm font-normal text-muted-foreground">Sites with GPS coordinates. Click a pin to open the dashboard for that site.</p>
        </CardHeader>
        <CardContent>
          <SitesOverviewMap sites={sites} />
        </CardContent>
      </Card>
    </div>
  );
}

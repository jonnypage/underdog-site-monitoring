"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { SitesOverviewMap } from "@/components/sites/sites-overview-map";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteStatusBadge } from "@/components/site-status-badge";
import { useGetSites } from "@/lib/useAPI";
import { Spinner } from "@/components/ui/spinner";

export default function SitesPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingSiteId, setPendingSiteId] = useState<string | null>(null);
  const { data, loading, error } = useGetSites();
  const sites = data?.getSites ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sites</h1>
        <p className="text-sm text-muted-foreground">Health across all assigned aquaponics sites.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Sites</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center gap-3 py-12">
              <Spinner size="md" />
              <p className="text-sm text-muted-foreground">Loading sites...</p>
            </div>
          ) : (
            <>
              {error ? <p className="text-sm text-red-600 mb-4">{error.message}</p> : null}
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
                    <div 
                      key={site.id} 
                      className={`group grid grid-cols-1 gap-2 py-4 px-2 -mx-2 rounded-md transition-colors cursor-pointer md:grid-cols-12 md:gap-4 md:py-3 md:items-center hover:bg-muted/50 ${isPending ? 'opacity-70 cursor-wait' : ''}`}
                      onClick={() => {
                        if (isPending) return;
                        setPendingSiteId(site.id);
                        startTransition(() => {
                          router.push(`/sites/${site.id}`);
                        });
                      }}
                      onMouseEnter={() => router.prefetch(`/sites/${site.id}`)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          if (isPending) return;
                          setPendingSiteId(site.id);
                          startTransition(() => router.push(`/sites/${site.id}`));
                        }
                      }}
                    >
                      <div className="col-span-1 md:col-span-6">
                        <div className="inline-flex max-w-full items-center gap-2 text-left font-medium text-primary">
                          {pendingSiteId === site.id && isPending ? (
                            <Spinner size="xs" />
                          ) : null}
                          <span className="min-w-0 text-base md:text-sm truncate">{site.name}</span>
                        </div>
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
            </>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Map</CardTitle>
          <p className="text-sm font-normal text-muted-foreground">Click a pin to open the dashboard for that site.</p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-[400px] items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/20">
              <Spinner size="md" />
              <p className="text-sm text-muted-foreground italic">
                Loading map coordinates...
              </p>
            </div>
          ) : (
            <SitesOverviewMap sites={sites} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

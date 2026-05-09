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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-3 pr-4">Site</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 pr-4">Last update</th>
                </tr>
              </thead>
              <tbody>
                {sites.map((site: any) => (
                  <tr key={site.id} className="border-b border-border last:border-0">
                    <td className="py-3 pr-4">
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
                        <span className="min-w-0 truncate">{site.name}</span>
                      </button>
                    </td>
                    <td className="py-3 pr-4">
                      <SiteStatusBadge status={site.status} />
                    </td>
                    <td className="py-3 pr-4">
                      {site.lastUpdate ? new Date(site.lastUpdate).toLocaleString() : "No data yet"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

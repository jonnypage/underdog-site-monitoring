"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@apollo/client";
import { useSession } from "next-auth/react";
import { AlertList } from "@/components/alerts/alert-list";
import { SensorSparkline } from "@/components/charts/sensor-sparkline";
import { SiteStatusBadge } from "@/components/site-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteDetailSkeleton } from "@/components/sites/site-detail-skeleton";
import { SiteLocationMap } from "@/components/sites/site-location-map";
import { GetAlertsDocument, GetMeasurementsDocument, GetSiteDocument, TimeRange as GqlTimeRange } from "@/lib/gql/generated/graphql";

export default function SiteDetailPage() {
  const params = useParams<{ id: string }>();
  const siteId = params.id;
  const { data: session, status: sessionStatus } = useSession();
  const isAdmin = sessionStatus === "authenticated" && session?.user?.role === "admin";
  const range = GqlTimeRange.Last_7D;
  const siteQuery = useQuery(GetSiteDocument, { variables: { id: siteId } });
  const measurementsQuery = useQuery(GetMeasurementsDocument, { variables: { siteId, range } });
  const alertsQuery = useQuery(GetAlertsDocument, { variables: { siteId } });

  const site = siteQuery.data?.getSite;
  const siteStillLoading = siteQuery.loading && !site;

  const activeReporting = useMemo(() => {
    const rep = site?.sensorReporting ?? [];
    return rep.filter((r) => r.enabled !== false);
  }, [site?.sensorReporting]);

  const chartData = useMemo(() => {
    const rows = measurementsQuery.data?.getMeasurements ?? [];
    return activeReporting.map((r) => ({
      key: r.key,
      data: rows
        .filter((row) => row.sensor === r.key)
        .map((row) => ({ x: row.takenAt, y: row.value }))
    }));
  }, [measurementsQuery.data, activeReporting]);

  const latest = useMemo(() => {
    const rows = measurementsQuery.data?.getMeasurements ?? [];
    return Object.fromEntries(
      activeReporting.map((r) => [r.key, [...rows].reverse().find((row) => row.sensor === r.key)])
    );
  }, [measurementsQuery.data, activeReporting]);

  const alerts = alertsQuery.data?.getAlerts ?? [];

  if (siteStillLoading) {
    return <SiteDetailSkeleton label="Loading site…" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{site?.name ?? "Site"}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin ? (
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href={`/admin/sites/${siteId}/edit`}>Edit site</Link>
            </Button>
          ) : null}
          {site?.status ? <SiteStatusBadge status={site.status} /> : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Active Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <AlertList alerts={alerts.filter((alert) => alert.status === "active")} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <AlertList alerts={alerts.slice(0, 10)} />
          </CardContent>
        </Card>
      </div>

      {activeReporting.length === 0 ? (
        <p className="text-sm text-muted-foreground">No sensors are enabled for this site. An administrator can enable them under Admin → Sites.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-4">
          {activeReporting.map((r) => (
            <Card key={r.key}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <CardTitle className="text-sm leading-tight">{r.displayName}</CardTitle>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase">{r.unit}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold leading-none">{latest[r.key]?.value ?? "-"}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <SensorSparkline 
                  data={chartData.find(c => c.key === r.key)?.data ?? []} 
                  min={r.physicalMin ?? undefined}
                  max={r.physicalMax ?? undefined}
                />
                {r.rangeMin != null && r.rangeMax != null ? (
                  <p className="mt-2 text-[10px] text-muted-foreground italic">Sensor range: {r.rangeMin}–{r.rangeMax} {r.unit}</p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {site?.latitude != null && site.longitude != null ? (
        <SiteLocationMap latitude={site.latitude} longitude={site.longitude} />
      ) : null}


    </div>
  );
}

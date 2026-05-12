"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { AlertList } from "@/components/alerts/alert-list";
import { SensorSparkline } from "@/components/charts/sensor-sparkline";
import { SiteStatusBadge } from "@/components/site-status-badge";
import { Button } from "@/components/ui/button";
import { EditNavButton } from "@/components/ui/edit-nav-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteDetailSkeleton } from "@/components/sites/site-detail-skeleton";
import { SiteLocationMap } from "@/components/sites/site-location-map";
import { SiteSensorCard } from "@/components/sites/site-sensor-card";
import { useGetSite, useGetMeasurements, useGetAlerts } from "@/lib/useAPI";
import { TimeRange as GqlTimeRange } from "@/lib/gql/generated/graphql";

export default function SiteDetailPage() {
  const params = useParams<{ id: string }>();
  const siteId = params.id;
  const { data: session, status: sessionStatus } = useSession();
  const isAdmin = sessionStatus === "authenticated" && session?.user?.role === "admin";
  const range = GqlTimeRange.Last_7D;
  const siteQuery = useGetSite({ id: siteId });
  const measurementsQuery = useGetMeasurements({ siteId, range });
  const alertsQuery = useGetAlerts({ siteId, status: "active" });

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
    return Object.fromEntries(
      activeReporting.map((r) => [r.key, r.currentValue])
    );
  }, [activeReporting]);

  const alerts = alertsQuery.data?.getAlerts ?? [];

  // Build key → icon name map so AlertList can show sensor icons on each alert row
  const sensorIconMap = useMemo(() => {
    return Object.fromEntries(
      (site?.sensorReporting ?? []).map((r) => [r.key, r.icon])
    ) as Record<string, string | null | undefined>;
  }, [site?.sensorReporting]);

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
            <EditNavButton href={`/admin/sites/${siteId}/edit`} variant="outline" size="sm">
              Edit site
            </EditNavButton>
          ) : null}
          {site?.status ? <SiteStatusBadge status={site.status} /> : null}
        </div>
      </div>

      <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Active Alerts</CardTitle>
            <Button type="button" variant="ghost" size="sm" asChild>
              <Link href={`/sites/${siteId}/alerts`}>Show all alerts →</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <AlertList alerts={alerts} refetch={alertsQuery.refetch} sensorIconMap={sensorIconMap} />
          </CardContent>
        </Card>

      {activeReporting.length === 0 ? (
        <p className="text-sm text-muted-foreground">No sensors are enabled for this site. An administrator can enable them under Admin → Sites.</p>
      ) : (
        <div className={`grid gap-4 ${
          activeReporting.length === 1 ? "md:grid-cols-1" :
          activeReporting.length === 2 ? "md:grid-cols-2" :
          activeReporting.length === 3 ? "md:grid-cols-3" :
          "md:grid-cols-4"
        }`}>
          {activeReporting.map((report) => (
            <SiteSensorCard
              key={report.key}
              siteId={siteId}
              sensor={report}
              chartData={chartData.find(c => c.key === report.key)?.data ?? []}
            />
          ))}
        </div>
      )}

      {site?.latitude != null && site.longitude != null ? (
        <SiteLocationMap latitude={site.latitude} longitude={site.longitude} />
      ) : null}


    </div>
  );
}

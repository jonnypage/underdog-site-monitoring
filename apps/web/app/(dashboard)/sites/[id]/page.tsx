"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@apollo/client";
import { useSession } from "next-auth/react";
import { AlertList } from "@/components/alerts/alert-list";
import { SensorLineChart } from "@/components/charts/sensor-line";
import { RangeSelector, type TimeRange } from "@/components/range-selector";
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
  const [range, setRange] = useState<TimeRange>(GqlTimeRange.Last_24H);
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
      id: `${r.displayName} (${r.unit})`,
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
              <CardHeader>
                <CardTitle className="text-sm leading-snug">{r.displayName}</CardTitle>
                <p className="text-xs font-normal text-muted-foreground">{r.unit}</p>
                {r.rangeMin != null && r.rangeMax != null ? (
                  <p className="text-xs text-muted-foreground">Alert range {r.rangeMin}–{r.rangeMax}</p>
                ) : null}
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{latest[r.key]?.value ?? "-"}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {site?.latitude != null && site.longitude != null ? (
        <SiteLocationMap latitude={site.latitude} longitude={site.longitude} />
      ) : null}

      {activeReporting.length > 0 ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle>Measurements</CardTitle>
            <RangeSelector value={range} onChange={setRange} />
          </CardHeader>
          <CardContent>
            <SensorLineChart data={chartData} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

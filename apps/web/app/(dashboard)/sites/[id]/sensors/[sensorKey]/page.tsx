"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HistoricalLineChart } from "@/components/charts/historical-line-chart";
import { SensorIcon } from "@/components/sensor-icon";
import { useGetSite, useGetSensorMeasurements } from "@/lib/useAPI";
import { TimeRange as GqlTimeRange } from "@/lib/gql/generated/graphql";
import { Spinner } from "@/components/ui/spinner";

export default function SensorHistoricalPage() {
  const params = useParams<{ id: string; sensorKey: string }>();
  const siteId = params.id;
  const sensorKey = params.sensorKey;

  const [range, setRange] = useState<GqlTimeRange>(GqlTimeRange.Last_7D);

  const siteQuery = useGetSite({ id: siteId });
  const measurementsQuery = useGetSensorMeasurements({ siteId, sensorKey, range });

  const site = siteQuery.data?.getSite;
  const sensorInfo = site?.sensorReporting.find(r => r.key === sensorKey);
  const rows = measurementsQuery.data?.getSensorMeasurements ?? [];

  const chartData = useMemo(() => {
    return rows.map((row) => ({
      x: row.takenAt,
      y: row.value
    }));
  }, [rows]);

  const stats = useMemo(() => {
    if (rows.length === 0) return { min: "-", max: "-", avg: "-" };
    const values = rows.map(r => r.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return {
      min: min.toFixed(2),
      max: max.toFixed(2),
      avg: avg.toFixed(2)
    };
  }, [rows]);

  if (siteQuery.loading && !site) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner size="md" />
        <span>Loading site…</span>
      </div>
    );
  }

  if (!sensorInfo) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">Sensor not found or disabled.</p>
        <Button variant="outline" asChild>
          <Link href={`/sites/${siteId}`}>Back to Site</Link>
        </Button>
      </div>
    );
  }

  const timeRangeLabel = range === GqlTimeRange.Last_24H ? "LAST_24H" : range === GqlTimeRange.Last_7D ? "LAST_7D" : "LAST_30D";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/sites/${siteId}`}>
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          {sensorInfo.icon && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <SensorIcon name={sensorInfo.icon} className="h-5 w-5" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{sensorInfo.displayName} History</h1>
            <p className="text-sm text-muted-foreground">{site?.name ?? "Site"}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button 
            variant={range === GqlTimeRange.Last_24H ? "default" : "outline"} 
            size="sm"
            onClick={() => setRange(GqlTimeRange.Last_24H)}
          >
            24h
          </Button>
          <Button 
            variant={range === GqlTimeRange.Last_7D ? "default" : "outline"} 
            size="sm"
            onClick={() => setRange(GqlTimeRange.Last_7D)}
          >
            7d
          </Button>
          <Button 
            variant={range === GqlTimeRange.Last_30D ? "default" : "outline"} 
            size="sm"
            onClick={() => setRange(GqlTimeRange.Last_30D)}
          >
            30d
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Average</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.avg} <span className="text-sm font-normal text-muted-foreground uppercase">{sensorInfo.unit}</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Minimum</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.min} <span className="text-sm font-normal text-muted-foreground uppercase">{sensorInfo.unit}</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Maximum</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.max} <span className="text-sm font-normal text-muted-foreground uppercase">{sensorInfo.unit}</span></p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trend ({range === GqlTimeRange.Last_24H ? 'Last 24 Hours' : range === GqlTimeRange.Last_7D ? 'Last 7 Days' : 'Last 30 Days'})</CardTitle>
        </CardHeader>
        <CardContent>
          {measurementsQuery.loading && chartData.length === 0 ? (
            <div className="flex h-[400px] items-center justify-center gap-2 text-sm text-muted-foreground">
              <Spinner size="md" />
              <span>Loading measurements…</span>
            </div>
          ) : (
            <HistoricalLineChart 
              data={chartData} 
              min={sensorInfo.physicalMin ?? undefined}
              max={sensorInfo.physicalMax ?? undefined}
              unit={sensorInfo.unit}
              timeRange={timeRangeLabel}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useQuery } from "@apollo/client";
import { AlertList } from "@/components/alerts/alert-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { GetAlertsDocument, GetSiteDocument } from "@/lib/gql/generated/graphql";
import { LoadingMessage } from "@/components/ui/spinner";
import { ChevronLeft } from "lucide-react";

export default function SiteAlertsPage() {
  const params = useParams<{ id: string }>();
  const siteId = params.id;

  const [statusFilter, setStatusFilter] = useState<string>("");

  const siteQuery = useQuery(GetSiteDocument, { variables: { id: siteId } });
  const alertsQuery = useQuery(GetAlertsDocument, {
    variables: { siteId, status: statusFilter || null },
  });

  const siteName = siteQuery.data?.getSite?.name ?? "Site";
  const alerts = alertsQuery.data?.getAlerts ?? [];

  const sensorIconMap = useMemo(() => {
    return Object.fromEntries(
      (siteQuery.data?.getSite?.sensorReporting ?? []).map((r) => [r.key, r.icon])
    ) as Record<string, string | null | undefined>;
  }, [siteQuery.data?.getSite?.sensorReporting]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="sm" asChild>
            <Link href={`/sites/${siteId}`}>
              <ChevronLeft className="h-4 w-4" />
              {siteName}
            </Link>
          </Button>
          <span className="text-muted-foreground">/</span>
          <h1 className="text-2xl font-semibold tracking-tight">All Alerts</h1>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="max-w-[200px]"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="resolved">Resolved</option>
          </Select>
        </CardContent>
      </Card>

      {/* Alert list */}
      <Card>
        <CardHeader>
          <CardTitle>
            {statusFilter === "active"
              ? "Active Alerts"
              : statusFilter === "resolved"
              ? "Resolved Alerts"
              : "All Alerts"}
            {!alertsQuery.loading && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({alerts.length})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alertsQuery.loading ? (
            <LoadingMessage>Loading alerts…</LoadingMessage>
          ) : alertsQuery.error ? (
            <p className="text-sm text-red-600">{alertsQuery.error.message}</p>
          ) : (
            <AlertList alerts={alerts} readonly sensorIconMap={sensorIconMap} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

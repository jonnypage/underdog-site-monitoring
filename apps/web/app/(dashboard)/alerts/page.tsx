"use client";

import { useState } from "react";
import { useQuery } from "@apollo/client";
import { AlertList } from "@/components/alerts/alert-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { GetAlertsDocument } from "@/lib/gql/generated/graphql";

export default function AlertsPage() {
  const [siteId, setSiteId] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const { data, loading, error } = useQuery(GetAlertsDocument, {
    variables: {
      siteId: siteId || null,
      type: type || null,
      status: status || null
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Alerts</h1>
        <p className="text-sm text-muted-foreground">Filter active and resolved alerts across your accessible sites.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Input placeholder="Site ID" value={siteId} onChange={(event) => setSiteId(event.target.value)} />
          <Input placeholder="Type (low_oxygen, ph_drift...)" value={type} onChange={(event) => setType(event.target.value)} />
          <Select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="resolved">Resolved</option>
          </Select>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground">Loading alerts...</p> : null}
          {error ? <p className="text-sm text-red-600">{error.message}</p> : null}
          <AlertList alerts={data?.getAlerts ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}

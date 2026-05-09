"use client";

import Link from "next/link";
import { useQuery } from "@apollo/client";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminSitesDocument, AdminUsersDocument } from "@/lib/gql/generated/graphql";

export function AdminDashboard() {
  const { data: usersData, loading: usersLoading, error: usersError } = useQuery(AdminUsersDocument);
  const { data: sitesData, loading: sitesLoading, error: sitesError } = useQuery(AdminSitesDocument);

  const users = usersData?.adminUsers ?? [];
  const sites = sitesData?.adminSites ?? [];
  const sensorCatalog = sitesData?.sensorCatalog ?? [];

  const siteNameById = useMemo(() => new Map(sites.map((s) => [s.id, s.name])), [sites]);

  const loading = usersLoading || sitesLoading;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Administration</h1>
        <p className="text-sm text-muted-foreground">
          Manage users and sites. Sensor types are listed at the bottom; use Manage sensors to add, edit, or remove entries.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Users</CardTitle>
          <Button type="button" size="sm" variant="outline" asChild>
            <Link href="/admin/users/new">Add user</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {usersError ? <p className="text-sm text-red-600">{usersError.message}</p> : null}
          {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-3 pr-4">Email</th>
                  <th className="py-3 pr-4">Name</th>
                  <th className="py-3 pr-4">Role</th>
                  <th className="py-3 pr-4">Sites</th>
                  <th className="py-3 pr-4" />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-border last:border-0">
                    <td className="py-3 pr-4 font-medium">{u.email}</td>
                    <td className="py-3 pr-4">{u.name ?? "—"}</td>
                    <td className="py-3 pr-4">{u.role}</td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {u.role === "admin"
                        ? "All sites"
                        : u.assignedSiteIds.length === 0
                          ? "—"
                          : u.assignedSiteIds.map((id) => siteNameById.get(id) ?? id).join(", ")}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <Button type="button" size="sm" variant="ghost" asChild>
                        <Link href={`/admin/users/${u.id}/edit`}>Edit</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Devices</CardTitle>
          <Button type="button" size="sm" variant="outline" asChild>
            <Link href="/admin/devices">Manage devices</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Register physical hardware, rotate API keys, and flash firmware to ESP32/ESP8266 nodes from your browser over USB.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Sites</CardTitle>
          <Button type="button" size="sm" variant="outline" asChild>
            <Link href="/admin/sites/new">Add site</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {sitesError ? <p className="text-sm text-red-600">{sitesError.message}</p> : null}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-3 pr-4">Name</th>
                  <th className="py-3 pr-4" />
                </tr>
              </thead>
              <tbody>
                {sites.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0">
                    <td className="py-3 pr-4 font-medium">{s.name}</td>
                    <td className="py-3 pr-4 text-right">
                      <Button type="button" size="sm" variant="ghost" asChild>
                        <Link href={`/admin/sites/${s.id}/edit`}>Edit</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Sensor catalog</CardTitle>
          <Button type="button" size="sm" variant="outline" asChild>
            <Link href="/admin/sensors">Manage sensors</Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Measurement types available for ingest and dashboards. Keys must match device payloads. Typical ranges are shown for reference.
          </p>
          {sitesError ? <p className="text-sm text-red-600">{sitesError.message}</p> : null}
          {sitesLoading ? (
            <p className="text-sm text-muted-foreground">Loading sensor catalog…</p>
          ) : sensorCatalog.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sensors defined yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-3 pr-4">Order</th>
                    <th className="py-3 pr-4">Key</th>
                    <th className="py-3 pr-4">Name</th>
                    <th className="py-3 pr-4">Unit</th>
                    <th className="py-3 pr-4">Typical range</th>
                  </tr>
                </thead>
                <tbody>
                  {sensorCatalog.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0">
                      <td className="py-3 pr-4 text-muted-foreground">{r.sortOrder}</td>
                      <td className="py-3 pr-4 font-mono text-xs">{r.key}</td>
                      <td className="py-3 pr-4 font-medium">{r.displayName}</td>
                      <td className="py-3 pr-4">{r.unit}</td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {r.physicalMin != null && r.physicalMax != null
                          ? `${r.physicalMin} – ${r.physicalMax}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

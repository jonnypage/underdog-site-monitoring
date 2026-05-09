"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apolloErrorMessage } from "@/lib/apollo-error-message";
import {
  AdminDevicesDocument,
  DeleteAdminDeviceDocument,
  RotateAdminDeviceApiKeyDocument
} from "@/lib/gql/generated/graphql";

export function AdminDevicesList() {
  const { data, loading, error, refetch } = useQuery(AdminDevicesDocument);
  const [rotateKey, { loading: rotating }] = useMutation(RotateAdminDeviceApiKeyDocument);
  const [deleteDevice, { loading: deleting }] = useMutation(DeleteAdminDeviceDocument);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rotatedKey, setRotatedKey] = useState<{ id: string; key: string } | null>(null);

  const grouped = useMemo(() => {
    const groups = new Map<string, { siteName: string; devices: typeof data extends infer T ? (T extends { adminDevices: infer D } ? D : never) : never }>();
    const devices = data?.adminDevices ?? [];
    for (const d of devices) {
      const g = groups.get(d.siteId);
      if (g) {
        g.devices.push(d);
      } else {
        groups.set(d.siteId, { siteName: d.siteName, devices: [d] });
      }
    }
    return [...groups.entries()]
      .map(([siteId, g]) => ({ siteId, ...g }))
      .sort((a, b) => a.siteName.localeCompare(b.siteName));
  }, [data]);

  async function onRotate(id: string, label: string) {
    setActionError(null);
    setRotatedKey(null);
    if (!confirm(`Rotate API key for "${label}"? The previous key stops working immediately.`)) {
      return;
    }
    try {
      const r = await rotateKey({ variables: { id } });
      const next = r.data?.rotateAdminDeviceApiKey;
      if (next) {
        setRotatedKey({ id, key: next });
      }
    } catch (err) {
      setActionError(apolloErrorMessage(err));
    }
  }

  async function onDelete(id: string, label: string) {
    setActionError(null);
    if (!confirm(`Delete device "${label}"? Past measurements stay in the database, but the device can no longer post.`)) {
      return;
    }
    try {
      await deleteDevice({ variables: { id } });
      await refetch();
    } catch (err) {
      setActionError(apolloErrorMessage(err));
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Registered devices</CardTitle>
        <Button type="button" size="sm" variant="outline" asChild>
          <Link href="/admin/devices/new">Add device</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {error ? <p className="text-sm text-red-600">{error.message}</p> : null}
        {actionError ? <p className="text-sm text-red-600">{actionError}</p> : null}
        {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}

        {rotatedKey ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
            <p className="font-medium">New API key (shown once):</p>
            <code className="mt-2 block break-all rounded bg-background p-2 font-mono text-xs">
              {rotatedKey.key}
            </code>
            <p className="mt-2 text-xs">
              Store this securely and reflash the device. Refreshing this page will hide the key permanently.
            </p>
          </div>
        ) : null}

        {grouped.length === 0 && !loading ? (
          <p className="text-sm text-muted-foreground">No devices yet. Use "Add device" to register one.</p>
        ) : null}

        {grouped.map((group) => (
          <div key={group.siteId} className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{group.siteName}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="py-3 pr-4">Device ID</th>
                    <th className="py-3 pr-4">Friendly name</th>
                    <th className="py-3 pr-4">Board</th>
                    <th className="py-3 pr-4">Interval</th>
                    <th className="py-3 pr-4">Last seen</th>
                    <th className="py-3 pr-4 text-right" />
                  </tr>
                </thead>
                <tbody>
                  {group.devices.map((d) => (
                    <tr key={d.id} className="border-b border-border last:border-0 align-top">
                      <td className="py-3 pr-4 font-mono text-xs">{d.deviceId}</td>
                      <td className="py-3 pr-4">{d.name ?? "—"}</td>
                      <td className="py-3 pr-4">{d.board ?? "—"}</td>
                      <td className="py-3 pr-4">{d.expectedIntervalSeconds}s</td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString() : "Never"}
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button type="button" size="sm" variant="default" asChild>
                            <Link href={`/admin/devices/${d.id}/install`}>Install</Link>
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={rotating}
                            onClick={() => onRotate(d.id, d.name ?? d.deviceId)}
                          >
                            Rotate key
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={deleting}
                            onClick={() => onDelete(d.id, d.name ?? d.deviceId)}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

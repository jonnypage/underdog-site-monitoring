"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apolloErrorMessage } from "@/lib/apollo-error-message";
import { AlertCircle } from "lucide-react";
import {
  AdminDevicesDocument,
  DeleteAdminDeviceDocument,
  RotateAdminDeviceApiKeyDocument
} from "@/lib/gql/generated/graphql";

export function AdminDevicesList({ overview = false }: { overview?: boolean }) {
  const { data, loading, error, refetch } = useQuery(AdminDevicesDocument);
  const [rotateKey, { loading: rotating }] = useMutation(RotateAdminDeviceApiKeyDocument);
  const [deleteDevice, { loading: deleting }] = useMutation(DeleteAdminDeviceDocument);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rotatedKey, setRotatedKey] = useState<{ id: string; key: string } | null>(null);
  const [deviceToDelete, setDeviceToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deviceToRotate, setDeviceToRotate] = useState<{ id: string; name: string } | null>(null);

  // We are creating a flat list instead of grouping by site.
  // We sort devices by site name, then device ID for a consistent order.
  const devices = [...(data?.adminDevices ?? [])].sort((a, b) => {
    const siteA = a.siteName || "Unassigned";
    const siteB = b.siteName || "Unassigned";
    if (siteA !== siteB) return siteA.localeCompare(siteB);
    return a.deviceId.localeCompare(b.deviceId);
  });

  async function onRotate(id: string) {
    setActionError(null);
    setRotatedKey(null);
    try {
      const r = await rotateKey({ variables: { id } });
      const next = r.data?.rotateAdminDeviceApiKey;
      if (next) {
        setRotatedKey({ id, key: next });
      }
      setDeviceToRotate(null);
    } catch (err) {
      setActionError(apolloErrorMessage(err));
    }
  }

  async function onDelete(id: string) {
    setActionError(null);
    try {
      await deleteDevice({ variables: { id } });
      await refetch();
      setDeviceToDelete(null);
    } catch (err) {
      setActionError(apolloErrorMessage(err));
    }
  }

  function getWarnings(device: NonNullable<typeof data>["adminDevices"][0]) {
    const warnings: string[] = [];
    if (!device.lastSeenAt) {
      warnings.push("Never seen");
    } else {
      const lastSeen = new Date(device.lastSeenAt).getTime();
      const intervalMs = device.expectedIntervalSeconds * 1000;
      // API scheduler considers it offline if more than 3x the interval has passed
      if (Date.now() - lastSeen > intervalMs * 3) {
        warnings.push("Offline");
      }
    }
    return warnings;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Registered devices</CardTitle>
        <Button type="button" size="sm" variant="outline" asChild>
          {overview ? (
            <Link href="/admin/devices">Manage devices</Link>
          ) : (
            <Link href="/admin/devices/new">Add device</Link>
          )}
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

        {devices.length === 0 && !loading ? (
          <p className="text-sm text-muted-foreground">No devices yet. Use "Add device" to register one.</p>
        ) : null}

        {devices.length > 0 && (
          <div className="flex flex-col text-sm">
            {/* Desktop Header */}
            {overview ? (
              <div className="hidden md:grid md:grid-cols-12 md:gap-4 border-b border-border py-3 text-left font-medium text-muted-foreground">
                <div className="col-span-3">Device</div>
                <div className="col-span-3">Site</div>
                <div className="col-span-2">Last seen</div>
                <div className="col-span-4">Warnings</div>
              </div>
            ) : (
              <div className="hidden lg:grid lg:grid-cols-12 lg:gap-4 border-b border-border py-3 text-left font-medium text-muted-foreground">
                <div className="col-span-2">Device ID</div>
                <div className="col-span-2">Friendly name</div>
                <div className="col-span-2">Board</div>
                <div className="col-span-1">Interval</div>
                <div className="col-span-2">Last seen</div>
                <div className="col-span-3 text-right">Actions</div>
              </div>
            )}
            
            {/* Device Rows */}
            <div className="divide-y divide-border">
              {devices.map((d) => {
                const warnings = getWarnings(d);
                return (
                  <div key={d.id} className={`grid grid-cols-1 gap-2 py-4 ${overview ? 'md:grid-cols-12 md:gap-4 md:py-3' : 'lg:grid-cols-12 lg:gap-4 lg:py-3'} md:items-center`}>
                    {overview ? (
                      <>
                        {/* Device Name */}
                        <div className="col-span-1 md:col-span-3 flex flex-col">
                          <span className="font-medium text-foreground truncate">{d.name ?? "—"}</span>
                          <span className="text-xs font-mono text-muted-foreground truncate">{d.deviceId}</span>
                        </div>

                        {/* Site */}
                        <div className="col-span-1 md:col-span-3 flex items-center gap-2">
                          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground md:hidden w-24">Site</span>
                          <span className="truncate text-foreground md:text-muted-foreground">{d.siteName ?? "Unassigned"}</span>
                        </div>

                        {/* Last Seen */}
                        <div className="col-span-1 md:col-span-2 flex items-center gap-2">
                          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground md:hidden w-24">Last seen</span>
                          <span className="text-muted-foreground md:text-foreground">
                            {d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString() : "Never"}
                          </span>
                        </div>

                        {/* Warnings */}
                        <div className="col-span-1 md:col-span-4 flex items-start gap-2 md:items-center">
                          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground md:hidden w-24 mt-0.5 md:mt-0">Warnings</span>
                          {warnings.length > 0 ? (
                            <div className="flex flex-col gap-1">
                              {warnings.map((w, i) => (
                                <span key={i} className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
                                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                  {w}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs md:text-sm">—</span>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Device ID */}
                        <div className="col-span-1 lg:col-span-2 flex items-center gap-2">
                          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground lg:hidden w-24">Device ID</span>
                          <span className="font-mono text-xs text-foreground truncate">{d.deviceId}</span>
                        </div>

                        {/* Friendly name */}
                        <div className="col-span-1 lg:col-span-2 flex items-center gap-2">
                          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground lg:hidden w-24">Name</span>
                          <span className="text-foreground truncate">{d.name ?? "—"}</span>
                        </div>

                        {/* Board */}
                        <div className="col-span-1 lg:col-span-2 flex items-center gap-2">
                          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground lg:hidden w-24">Board</span>
                          <span className="text-foreground truncate">{d.board ?? "—"}</span>
                        </div>

                        {/* Interval */}
                        <div className="col-span-1 lg:col-span-1 flex items-center gap-2">
                          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground lg:hidden w-24">Interval</span>
                          <span className="text-foreground">{d.expectedIntervalSeconds}s</span>
                        </div>

                        {/* Last Seen */}
                        <div className="col-span-1 lg:col-span-2 flex items-center gap-2">
                          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground lg:hidden w-24">Last seen</span>
                          <span className="text-muted-foreground lg:text-foreground">
                            {d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString() : "Never"}
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="col-span-1 lg:col-span-3 flex flex-wrap items-center gap-2 lg:justify-end mt-2 lg:mt-0">
                          <Button type="button" size="sm" variant="default" asChild>
                            <Link href={`/admin/devices/${d.id}/install`}>Install</Link>
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={rotating}
                            onClick={() => setDeviceToRotate({ id: d.id, name: d.name ?? d.deviceId })}
                          >
                            Rotate
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                          className="hover:bg-destructive hover:text-destructive-foreground"
                            disabled={deleting}
                            onClick={() => setDeviceToDelete({ id: d.id, name: d.name ?? d.deviceId })}
                          >
                          Delete
                        </Button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>

      {deviceToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-xl animate-in zoom-in-95 duration-200">
            <h2 className="text-lg font-semibold">Delete device</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Are you sure you want to delete the device <strong>{deviceToDelete.name}</strong>? 
              Past measurements will stay in the database, but the device can no longer post.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setDeviceToDelete(null)} disabled={deleting}>
                Cancel
              </Button>
              <Button type="button" variant="default" className="bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:opacity-90" onClick={() => onDelete(deviceToDelete.id)} disabled={deleting}>
                {deleting ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {deviceToRotate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-xl animate-in zoom-in-95 duration-200">
            <h2 className="text-lg font-semibold">Rotate API key</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Are you sure you want to rotate the API key for <strong>{deviceToRotate.name}</strong>? 
              The previous key will stop working immediately and the device will need to be reflashed.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setDeviceToRotate(null)} disabled={rotating}>
                Cancel
              </Button>
              <Button type="button" variant="default" onClick={() => onRotate(deviceToRotate.id)} disabled={rotating}>
                {rotating ? "Rotating..." : "Rotate Key"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}


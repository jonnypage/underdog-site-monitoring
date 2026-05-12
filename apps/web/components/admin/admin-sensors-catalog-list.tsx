"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DangerActionButton,
  destructiveCatalogDialogLabels,
  removeSensorFromCatalogDescription,
} from "@/components/ui/danger-action";
import { EditNavButton } from "@/components/ui/edit-nav-button";
import { LoadingMessage } from "@/components/ui/spinner";
import { apolloErrorMessage } from "@/lib/apollo-error-message";
import { useAdminSensorCatalogList, useDeleteSensorCatalogEntry } from "@/lib/useAPI";
import * as LucideIcons from "lucide-react";

type LucideIconComponent = React.ComponentType<{ className?: string }>;

function getLucideIcon(name: string | null | undefined): LucideIconComponent | null {
  if (!name) return null;
  const key = name
    .trim()
    .replace(/[-_\s]+(.)/g, (_, c: string) => c.toUpperCase())
    .replace(/^(.)/, (c: string) => c.toUpperCase());
  const icon = (LucideIcons as Record<string, unknown>)[key];
  if (!icon) return null;
  if (typeof icon === "function") return icon as LucideIconComponent;
  if (typeof icon === "object" && "$$typeof" in (icon as object)) return icon as LucideIconComponent;
  return null;
}

function SensorIcon({ name, className = "h-4 w-4" }: { name?: string | null; className?: string }) {
  const Icon = getLucideIcon(name);
  if (!Icon) return null;
  return <Icon className={className} />;
}

export function AdminSensorsCatalogList() {
  const { data, loading, error, refetch } = useAdminSensorCatalogList();
  const [deleteEntry, { loading: deleting }] = useDeleteSensorCatalogEntry();
  const [sensorToDelete, setSensorToDelete] = useState<{ id: string; key: string } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const rows = data?.sensorCatalog ?? [];

  async function confirmDeleteSensor() {
    if (!sensorToDelete) return;
    setDeleteError(null);
    try {
      await deleteEntry({ variables: { id: sensorToDelete.id } });
      await refetch();
      setSensorToDelete(null);
    } catch (err) {
      setDeleteError(apolloErrorMessage(err));
    }
  }

  const busy = deleting;

  return (
    <div className='space-y-8'>
      <Card>
        <CardHeader>
          <CardTitle>All sensors</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className='text-sm text-red-600'>{error.message}</p>
          ) : null}
          {loading ? <LoadingMessage>Loading…</LoadingMessage> : null}
          <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='border-b border-border text-left'>
                  <th className='py-3 pr-4'>Order</th>
                  <th className='py-3 pr-4'>Icon</th>
                  <th className='py-3 pr-4'>Key</th>
                  <th className='py-3 pr-4'>Name</th>
                  <th className='py-3 pr-4'>Unit</th>
                  <th className='py-3 pr-4'>Typical range</th>
                  <th className='py-3 pr-4' />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className='border-b border-border last:border-0'
                  >
                    <td className='py-3 pr-4 text-muted-foreground'>
                      {r.sortOrder}
                    </td>
                    <td className='py-3 pr-4'>
                      {r.icon ? (
                        <div className='flex items-center gap-1.5 text-muted-foreground'>
                          <SensorIcon name={r.icon} className='h-4 w-4' />
                          <span className='font-mono text-xs'>{r.icon}</span>
                        </div>
                      ) : (
                        <span className='text-xs text-muted-foreground'>—</span>
                      )}
                    </td>
                    <td className='py-3 pr-4'>
                      <span className='inline-block rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-medium text-foreground'>
                        {r.key}
                      </span>
                    </td>
                    <td className='py-3 pr-4 font-medium'>{r.displayName}</td>
                    <td className='py-3 pr-4'>{r.unit}</td>
                    <td className='py-3 pr-4 text-muted-foreground'>
                      {r.physicalMin != null && r.physicalMax != null
                        ? `${r.physicalMin} – ${r.physicalMax}`
                        : '—'}
                    </td>
                    <td className='py-3 pr-4 text-right'>
                      <div className='flex justify-end gap-2'>
                        <EditNavButton href={`/admin/sensors/${r.id}/edit`} />
                        <DangerActionButton
                          intent="remove"
                          onClick={() => {
                            setDeleteError(null);
                            setSensorToDelete({ id: r.id, key: r.key });
                          }}
                          disabled={busy}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className='text-sm text-muted-foreground'>
        <Link className='text-primary underline' href='/admin'>
          ← Back to admin
        </Link>
      </p>

      <ConfirmDialog
        open={!!sensorToDelete}
        onOpenChange={(open) => {
          if (!open) {
            setSensorToDelete(null);
            setDeleteError(null);
          }
        }}
        {...destructiveCatalogDialogLabels("sensor", "remove")}
        confirmTone="destructive"
        pending={deleting}
        onConfirm={confirmDeleteSensor}
      >
        <>
          {sensorToDelete ? removeSensorFromCatalogDescription(sensorToDelete.key) : null}
          {deleteError ? <p className="mt-3 text-sm text-red-600">{deleteError}</p> : null}
        </>
      </ConfirmDialog>
    </div>
  );
}

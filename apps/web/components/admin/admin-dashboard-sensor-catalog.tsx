'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAdminSites } from '@/lib/useAPI';
import { LoadingMessage } from '@/components/ui/spinner';

export function AdminDashboardSensorCatalog() {
  const {
    data: sitesData,
    loading: sitesLoading,
    error: sitesError,
  } = useAdminSites();
  const sensorCatalog = sitesData?.sensorCatalog ?? [];

  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between space-y-0'>
        <CardTitle>Sensor catalog</CardTitle>
        <Button type='button' size='sm' variant='outline' asChild>
          <Link href='/admin/sensors'>Manage sensors</Link>
        </Button>
      </CardHeader>
      <CardContent className='space-y-4'>
        <p className='text-sm text-muted-foreground'>
          Measurement types available for ingest and dashboards. Keys must
          match device payloads. Typical ranges are shown for reference.
        </p>
        {sitesError ? (
          <p className='text-sm text-red-600'>{sitesError.message}</p>
        ) : null}
        {sitesLoading ? (
          <LoadingMessage>Loading sensor catalog…</LoadingMessage>
        ) : sensorCatalog.length === 0 ? (
          <p className='text-sm text-muted-foreground'>
            No sensors defined yet.
          </p>
        ) : (
          <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='border-b border-border text-left'>
                  <th className='py-3 pr-4'>Order</th>
                  <th className='py-3 pr-4'>Key</th>
                  <th className='py-3 pr-4'>Name</th>
                  <th className='py-3 pr-4'>Unit</th>
                  <th className='py-3 pr-4'>Typical range</th>
                </tr>
              </thead>
              <tbody>
                {sensorCatalog.map((r) => (
                  <tr
                    key={r.id}
                    className='border-b border-border last:border-0'
                  >
                    <td className='py-3 pr-4 text-muted-foreground'>
                      {r.sortOrder}
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

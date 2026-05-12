'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAdminSites } from '@/lib/useAPI';
import { LoadingMessage } from '@/components/ui/spinner';

export function AdminDashboardSites() {
  const {
    data: sitesData,
    loading: sitesLoading,
    error: sitesError,
  } = useAdminSites();
  const sites = sitesData?.adminSites ?? [];

  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between space-y-0'>
        <CardTitle>Sites</CardTitle>
        <Button type='button' size='sm' variant='outline' asChild>
          <Link href='/admin/sites/new'>Add site</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {sitesError ? (
          <p className='text-sm text-red-600'>{sitesError.message}</p>
        ) : null}
        {sitesLoading ? <LoadingMessage>Loading sites…</LoadingMessage> : null}
        <div className='overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b border-border text-left'>
                <th className='py-3 pr-4'>Name</th>
                <th className='py-3 pr-4' />
              </tr>
            </thead>
            <tbody>
              {sites.map((s) => (
                <tr
                  key={s.id}
                  className='border-b border-border transition-colors last:border-0 hover:bg-muted/60'
                >
                  <td className='py-3 pr-4 font-medium'>{s.name}</td>
                  <td className='py-3 pr-4 text-right'>
                    <Button type='button' size='sm' variant='ghost' asChild>
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
  );
}

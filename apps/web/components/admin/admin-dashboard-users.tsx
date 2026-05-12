'use client';

import Link from 'next/link';
import { useQuery } from '@apollo/client';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AdminSitesDocument,
  AdminUsersDocument,
} from '@/lib/gql/generated/graphql';
import { roleDisplayName } from '@/lib/role-display-name';
import { LoadingMessage } from '@/components/ui/spinner';

/** Display order: admin → site_manager → site_viewer; unknown roles last. */
const ROLE_ORDER: Record<string, number> = {
  admin: 0,
  site_manager: 1,
  site_viewer: 2,
};

export function AdminDashboardUsers() {
  const {
    data: usersData,
    loading: usersLoading,
    error: usersError,
  } = useQuery(AdminUsersDocument);
  const { data: sitesData, loading: sitesLoading } =
    useQuery(AdminSitesDocument);

  const users = usersData?.adminUsers ?? [];
  const sites = sitesData?.adminSites ?? [];
  const siteNameById = useMemo(
    () => new Map(sites.map((s) => [s.id, s.name])),
    [sites],
  );

  const usersSortedByRole = useMemo(() => {
    return [...users].sort((a, b) => {
      const ra = ROLE_ORDER[a.role] ?? 99;
      const rb = ROLE_ORDER[b.role] ?? 99;
      if (ra !== rb) return ra - rb;
      return a.email.localeCompare(b.email);
    });
  }, [users]);

  const loading = usersLoading || sitesLoading;

  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between space-y-0'>
        <CardTitle>Users</CardTitle>
        <Button type='button' size='sm' variant='outline' asChild>
          <Link href='/admin/users/new'>Add user</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {usersError ? (
          <p className='text-sm text-red-600'>{usersError.message}</p>
        ) : null}
        {loading ? <LoadingMessage>Loading…</LoadingMessage> : null}
        <div className='overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b border-border text-left'>
                <th className='py-3 pr-4'>Email</th>
                <th className='py-3 pr-4'>Name</th>
                <th className='py-3 pr-4'>Role</th>
                <th className='py-3 pr-4'>Sites</th>
                <th className='py-3 pr-4' />
              </tr>
            </thead>
            <tbody>
              {usersSortedByRole.map((u) => (
                <tr
                  key={u.id}
                  className='border-b border-border transition-colors last:border-0 hover:bg-muted/60'
                >
                  <td className='py-3 pr-4 font-medium'>{u.email}</td>
                  <td className='py-3 pr-4'>{u.name ?? '—'}</td>
                  <td className='py-3 pr-4'>
                    <span className='inline-block rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground'>
                      {roleDisplayName(u.role)}
                    </span>
                  </td>
                  <td className='py-3 pr-4'>
                    {u.role === 'admin' ? (
                      <span className='text-muted-foreground'>All sites</span>
                    ) : u.assignedSiteIds.length === 0 ? (
                      <span className='text-muted-foreground'>—</span>
                    ) : (
                      <div className='flex max-w-xs flex-wrap gap-1.5'>
                        {u.assignedSiteIds.map((id) => (
                          <span
                            key={id}
                            className='inline-block rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-medium text-foreground dark:bg-primary/15'
                          >
                            {siteNameById.get(id) ?? id}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className='py-3 pr-4 text-right'>
                    <Button type='button' size='sm' variant='ghost' asChild>
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
  );
}

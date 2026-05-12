'use client';

import { AdminDevicesList } from '@/components/admin/admin-devices-list';
import { AdminDashboardSensorCatalog } from '@/components/admin/admin-dashboard-sensor-catalog';
import { AdminDashboardSites } from '@/components/admin/admin-dashboard-sites';
import { AdminDashboardUsers } from '@/components/admin/admin-dashboard-users';

export function AdminDashboard() {
  return (
    <div className='space-y-10'>
      <div>
        <h1 className='text-2xl font-semibold tracking-tight'>
          Administration
        </h1>
        <p className='text-sm text-muted-foreground'>
          Manage sites, users, devices and sensors.
        </p>
      </div>

      <AdminDashboardSites />
      <AdminDashboardUsers />
      <AdminDevicesList overview />
      <AdminDashboardSensorCatalog />
    </div>
  );
}

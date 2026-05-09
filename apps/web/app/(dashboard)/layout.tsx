import { DashboardMobileNav } from '@/components/dashboard-mobile-nav';
import { DashboardSidebar } from '@/components/dashboard-sidebar';
import { DashboardUserMenu } from '@/components/dashboard-user-menu';
import { OrgLogo } from '@/components/org-logo';
import { auth } from '@/lib/auth';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <div className='min-h-screen bg-muted/30'>
      <DashboardSidebar />
      <div className='md:pl-64'>
        <header className='sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b border-border bg-background px-6'>
          <div className='flex min-w-0 flex-1 items-center gap-3 md:hidden'>
            <DashboardMobileNav />
            <OrgLogo variant='header' />
          </div>
          <div className='flex flex-1 justify-end'>
            <DashboardUserMenu email={session?.user?.email ?? null} />
          </div>
        </header>
        <main className='p-6'>{children}</main>
      </div>
    </div>
  );
}

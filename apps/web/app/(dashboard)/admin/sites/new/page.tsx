import { AdminSiteForm } from "@/components/admin/admin-site-form";

export default function AdminNewSitePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add site</h1>
        <p className="text-sm text-muted-foreground">Create a site, optional GPS, and sensor reporting toggles.</p>
      </div>
      <AdminSiteForm mode="create" />
    </div>
  );
}

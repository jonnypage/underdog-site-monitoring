import { AdminSiteForm } from "@/components/admin/admin-site-form";

export default async function AdminEditSitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit site</h1>
        <p className="text-sm text-muted-foreground">Update name, map coordinates, and which sensors report and alert.</p>
      </div>
      <AdminSiteForm mode="edit" siteId={id} />
    </div>
  );
}

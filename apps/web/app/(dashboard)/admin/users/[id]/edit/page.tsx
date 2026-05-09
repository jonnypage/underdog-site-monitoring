import { AdminUserForm } from "@/components/admin/admin-user-form";

export default async function AdminEditUserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit user</h1>
        <p className="text-sm text-muted-foreground">Update account details, role, and site access.</p>
      </div>
      <AdminUserForm mode="edit" userId={id} />
    </div>
  );
}

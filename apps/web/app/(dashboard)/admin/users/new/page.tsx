import { AdminUserForm } from "@/components/admin/admin-user-form";

export default function AdminNewUserPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add user</h1>
        <p className="text-sm text-muted-foreground">Create a user and assign sites for managers and viewers.</p>
      </div>
      <AdminUserForm mode="create" />
    </div>
  );
}

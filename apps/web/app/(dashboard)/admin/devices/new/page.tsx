import { AdminDeviceCreate } from "@/components/admin/admin-device-create";

export default function AdminNewDevicePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add device</h1>
        <p className="text-sm text-muted-foreground">
          Register a new ESP node and generate its API key. The key is shown once; copy it before continuing to the firmware installer.
        </p>
      </div>
      <AdminDeviceCreate />
    </div>
  );
}

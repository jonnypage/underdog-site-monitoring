import { AdminSensorsManager } from "@/components/admin/admin-sensors-manager";

export default function AdminSensorsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sensor catalog</h1>
        <p className="text-sm text-muted-foreground">
          Global sensor definitions: ingest keys, labels, units, and typical physical ranges. New sensors are enabled by default on every existing site; adjust per site under Sites → Edit.
        </p>
      </div>
      <AdminSensorsManager />
    </div>
  );
}

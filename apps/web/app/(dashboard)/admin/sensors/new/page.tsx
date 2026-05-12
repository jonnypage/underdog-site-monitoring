import Link from "next/link";
import { AdminSensorForm } from "@/components/admin/admin-sensor-form";

export default function AdminNewSensorPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link className="text-primary underline" href="/admin/sensors">
            ← Sensor catalog
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Add sensor</h1>
        <p className="text-sm text-muted-foreground">
          Keys must match <code className="rounded bg-muted px-1 font-mono text-xs">readings</code> in device payloads. The sensor
          stays <strong className="font-medium text-foreground">off</strong> for every site until you enable it under{" "}
          <strong className="font-medium text-foreground">Sites → Edit</strong>.
        </p>
      </div>
      <AdminSensorForm mode="create" />
    </div>
  );
}

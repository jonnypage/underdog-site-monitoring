import Link from "next/link";
import { AdminSensorEditContent } from "@/components/admin/admin-sensor-edit-content";

export default async function AdminEditSensorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link className="text-primary underline" href="/admin/sensors">
            ← Sensor catalog
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Edit sensor</h1>
        <p className="text-sm text-muted-foreground">Update display name, unit, typical range, sort order, and icon.</p>
      </div>
      <AdminSensorEditContent sensorId={id} />
    </div>
  );
}

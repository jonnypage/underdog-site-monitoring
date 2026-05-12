import Link from "next/link";
import { AdminSensorsCatalogList } from "@/components/admin/admin-sensors-catalog-list";
import { Button } from "@/components/ui/button";

export default function AdminSensorsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sensor catalog</h1>
          <p className="text-sm text-muted-foreground">
            Global sensor definitions: ingest keys, labels, units, and typical physical ranges for dashboards and ingest validation. A
            new catalog sensor is <strong className="font-medium text-foreground">not</strong> enabled for any site until you turn it
            on under <strong className="font-medium text-foreground">Sites → Edit</strong>.
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" asChild>
          <Link href="/admin/sensors/new">Add sensor</Link>
        </Button>
      </div>
      <AdminSensorsCatalogList />
    </div>
  );
}

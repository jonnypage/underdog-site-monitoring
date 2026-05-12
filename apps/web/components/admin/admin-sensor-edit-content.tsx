"use client";

import Link from "next/link";
import { AdminSensorForm } from "@/components/admin/admin-sensor-form";
import { Button } from "@/components/ui/button";
import { LoadingMessage } from "@/components/ui/spinner";
import { useAdminSensorCatalogList } from "@/lib/useAPI";

export function AdminSensorEditContent({ sensorId }: { sensorId: string }) {
  const { data, loading, error } = useAdminSensorCatalogList();
  const row = data?.sensorCatalog.find((r) => r.id === sensorId);

  if (loading) {
    return <LoadingMessage>Loading sensor…</LoadingMessage>;
  }

  if (error) {
    return <p className="text-sm text-red-600">{error.message}</p>;
  }

  if (!row) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-600">Sensor not found.</p>
        <Button type="button" variant="outline" asChild>
          <Link href="/admin/sensors">Back to sensor catalog</Link>
        </Button>
      </div>
    );
  }

  return <AdminSensorForm mode="edit" catalogEntry={row} />;
}

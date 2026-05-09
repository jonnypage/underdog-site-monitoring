import { AdminDevicesList } from "@/components/admin/admin-devices-list";

export default function AdminDevicesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Devices</h1>
        <p className="text-sm text-muted-foreground">
          Register physical hardware, rotate API keys, and flash firmware to ESP devices over USB.
        </p>
      </div>
      <AdminDevicesList />
    </div>
  );
}

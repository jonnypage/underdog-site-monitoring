import { DeviceInstallWizard } from "@/components/admin/device-install-wizard";

export default async function AdminDeviceInstallPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Install firmware</h1>
        <p className="text-sm text-muted-foreground">
          Plug your ESP device into a USB port, connect, and flash. Use Chrome or Edge on a desktop.
        </p>
      </div>
      <DeviceInstallWizard deviceUuid={id} apiBaseUrl={apiBaseUrl} />
    </div>
  );
}

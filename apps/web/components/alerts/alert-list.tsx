import { Badge } from "@/components/ui/badge";

export interface AlertListItem {
  id: string;
  type: string;
  severity: string;
  status: string;
  message: string;
  createdAt: string;
  resolvedAt?: string | null;
}

export function AlertList({ alerts }: { alerts: AlertListItem[] }) {
  if (alerts.length === 0) {
    return <p className="text-sm text-muted-foreground">No alerts found.</p>;
  }

  return (
    <div className="divide-y divide-border rounded-md border border-border">
      {alerts.map((alert) => (
        <div key={alert.id} className="space-y-2 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{alert.severity}</Badge>
            <Badge>{alert.status}</Badge>
            <span className="text-sm font-medium">{alert.type}</span>
          </div>
          <p className="text-sm">{alert.message}</p>
          <p className="text-xs text-muted-foreground">{new Date(alert.createdAt).toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}

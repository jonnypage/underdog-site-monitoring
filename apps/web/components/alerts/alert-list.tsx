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

const ALERT_TYPE_LABELS: Record<string, string> = {
  device_offline: "Device Offline",
  temperature_spike: "Temperature Spike",
  temperature_spike_flatline: "Temperature Flatline",
  ph_drift: "pH Drift",
  ph_drift_flatline: "pH Flatline",
  low_oxygen: "Low Oxygen",
  low_oxygen_flatline: "Oxygen Flatline",
  water_level_issue: "Water Level Issue",
  water_level_issue_flatline: "Water Level Flatline",
};

function getAlertLabel(type: string) {
  if (ALERT_TYPE_LABELS[type]) return ALERT_TYPE_LABELS[type];

  const rv = /^range_violation:(.+)$/.exec(type);
  if (rv) return `Critical Range: ${rv[1]}`;

  const rw = /^range_warning:(.+)$/.exec(type);
  if (rw) return `Range Warning: ${rw[1]}`;

  return type
    .split("_")
    .map((s) => (s.charAt(0).toUpperCase() + s.slice(1)))
    .join(" ");
}

function FormattedMessage({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.8em] font-medium">
              {part.slice(1, -1)}
            </code>
          );
        }
        return part;
      })}
    </>
  );
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
            <span className="text-sm font-bold">{getAlertLabel(alert.type)}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{alert.severity}</Badge>
            <Badge>{alert.status}</Badge>
          </div>
          <p className="text-sm leading-relaxed text-foreground/90">
            <FormattedMessage text={alert.message} />
          </p>
          <p className="text-xs text-muted-foreground">{new Date(alert.createdAt).toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}

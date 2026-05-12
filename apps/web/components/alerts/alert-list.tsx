"use client";

import { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { SensorIcon } from "@/components/sensor-icon";
import { StatusPill } from "@/components/status-pill";
import { DangerIconButton } from "@/components/ui/danger-action";
import { useResolveAlert } from "@/lib/useAPI";
import { cn } from "@/lib/utils";

export interface AlertListItem {
  id: string;
  type: string;
  severity: string;
  status: string;
  message: string;
  createdAt: string;
  resolvedAt?: string | null;
}

/** Fixed Lucide icon name for alert types that are NOT tied to a sensor. */
const ALERT_TYPE_ICONS: Record<string, string> = {
  device_offline: "WifiOff",
};

/** Derive a sensor catalog key from an alert type. Returns null for non-sensor alerts. */
function sensorKeyForAlertType(type: string): string | null {
  // Structured types: range_violation:temperature, range_warning:ph
  const rv = /^range_(?:violation|warning):(.+)$/.exec(type);
  if (rv) return rv[1];
  // Legacy heuristic types keyed to sensor
  if (type.startsWith("temperature")) return "temperature";
  if (type.startsWith("ph")) return "ph";
  if (type.startsWith("low_oxygen")) return "dissolvedOxygen";
  if (type.startsWith("water_level")) return "waterLevel";
  return null;
}

/** Resolve the best icon name for any alert type. */
function iconForAlert(type: string, sensorIconMap?: Record<string, string | null | undefined>): string | null {
  // Non-sensor fixed icons first
  if (ALERT_TYPE_ICONS[type]) return ALERT_TYPE_ICONS[type];
  // Sensor-based icon from catalog
  const sKey = sensorKeyForAlertType(type);
  if (sKey && sensorIconMap) return sensorIconMap[sKey] ?? null;
  return null;
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
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
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

// ── Accordion row (dismissable, used on the site dashboard) ──────────────────

function AlertAccordionRow({
  alert,
  onDismissed,
  sensorIconMap,
}: {
  alert: AlertListItem;
  onDismissed: (id: string) => void;
  sensorIconMap?: Record<string, string | null | undefined>;
}) {
  const [open, setOpen] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [resolveAlert] = useResolveAlert();

  const canDismiss = alert.status === "active";

  async function handleDismiss(e: React.MouseEvent) {
    e.stopPropagation();
    if (!canDismiss || dismissing) return;
    setDismissing(true);
    try {
      await resolveAlert({ variables: { id: alert.id } });
      onDismissed(alert.id);
    } catch {
      setDismissing(false);
    }
  }

  return (
    <div className={cn(
      "border-b border-border last:border-0 transition-colors",
      open && "bg-muted/30"
    )}>
      <div className="flex w-full items-center gap-1">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
              open && "rotate-180"
            )}
          />
          {(() => {
            const iconName = iconForAlert(alert.type, sensorIconMap);
            return iconName ? (
              <span className="shrink-0 text-muted-foreground">
                <SensorIcon name={iconName} className="h-4 w-4" />
              </span>
            ) : null;
          })()}
          <span className="flex-1 text-sm font-semibold leading-snug">
            {getAlertLabel(alert.type)}
          </span>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            <StatusPill value={alert.severity} />
            <StatusPill value={alert.status} />
          </div>
          <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
            {new Date(alert.createdAt).toLocaleString()}
          </span>
        </button>
        {canDismiss && (
          <DangerIconButton
            disabled={dismissing}
            onClick={handleDismiss}
            className="mr-3"
          >
            <X className="h-3.5 w-3.5" />
          </DangerIconButton>
        )}
      </div>

      {!open && (
        <p className="px-4 pb-2 text-xs text-muted-foreground sm:hidden">
          {new Date(alert.createdAt).toLocaleString()}
        </p>
      )}

      {open && (
        <div className="px-4 pb-4 pt-1 text-sm space-y-3">
          <p className="leading-relaxed text-foreground/90">
            <FormattedMessage text={alert.message} />
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
            <span>
              <span className="font-medium text-foreground">Created:</span>{" "}
              {new Date(alert.createdAt).toLocaleString()}
            </span>
            {alert.resolvedAt && (
              <span>
                <span className="font-medium text-foreground">Resolved:</span>{" "}
                {new Date(alert.resolvedAt).toLocaleString()}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Flat read-only row (used on the all-alerts history page) ─────────────────

function AlertFlatRow({
  alert,
  sensorIconMap,
}: {
  alert: AlertListItem;
  sensorIconMap?: Record<string, string | null | undefined>;
}) {
  const iconName = iconForAlert(alert.type, sensorIconMap);
  return (
    <div className="border-b border-border last:border-0 px-4 py-4 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {iconName && (
          <span className="text-muted-foreground">
            <SensorIcon name={iconName} className="h-4 w-4" />
          </span>
        )}
        <span className="text-sm font-semibold">{getAlertLabel(alert.type)}</span>
        <StatusPill value={alert.severity} />
        <StatusPill value={alert.status} />
      </div>
      <p className="text-sm leading-relaxed text-foreground/90">
        <FormattedMessage text={alert.message} />
      </p>
      <div className="flex flex-wrap gap-x-6 gap-y-0.5 text-xs text-muted-foreground">
        <span>
          <span className="font-medium text-foreground">Created:</span>{" "}
          {new Date(alert.createdAt).toLocaleString()}
        </span>
        {alert.resolvedAt && (
          <span>
            <span className="font-medium text-foreground">Resolved:</span>{" "}
            {new Date(alert.resolvedAt).toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Public component ─────────────────────────────────────────────────────────

export function AlertList({
  alerts,
  refetch,
  readonly = false,
  sensorIconMap,
}: {
  alerts: AlertListItem[];
  refetch?: () => void;
  /** When true: flat read-only list, no dismiss button, no accordion. */
  readonly?: boolean;
  /** Map of sensor catalog key → Lucide icon name, used to show the sensor icon on each alert row. */
  sensorIconMap?: Record<string, string | null | undefined>;
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = alerts.filter((a) => !dismissed.has(a.id));

  function handleDismissed(id: string) {
    setDismissed((prev) => new Set(prev).add(id));
    refetch?.();
  }

  if (visible.length === 0) {
    return <p className="text-sm text-muted-foreground">No alerts found.</p>;
  }

  return (
    <div className="rounded-md border border-border divide-y-0">
      {visible.map((alert) =>
        readonly ? (
          <AlertFlatRow key={alert.id} alert={alert} sensorIconMap={sensorIconMap} />
        ) : (
          <AlertAccordionRow key={alert.id} alert={alert} onDismissed={handleDismissed} sensorIconMap={sensorIconMap} />
        )
      )}
    </div>
  );
}

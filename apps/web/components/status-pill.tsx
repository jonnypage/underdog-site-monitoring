import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusPillVariant = 
  | "healthy"
  | "warning"
  | "critical"
  | "active"
  | "resolved"
  | "default";

interface StatusPillProps {
  value: string;
  variant?: StatusPillVariant;
  className?: string;
}

const variantStyles: Record<StatusPillVariant, string> = {
  healthy: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:border-emerald-900/50",
  warning: "border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:border-amber-900/50",
  critical: "border-red-200 bg-red-50 text-red-700 dark:bg-red-950 dark:border-red-900/50",
  active: "border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:border-blue-900/50",
  resolved: "border-slate-200 bg-slate-50 text-slate-700 dark:bg-slate-900 dark:border-slate-800",
  default: "border-border bg-muted/80 text-foreground"
};

export function StatusPill({ value, variant, className }: StatusPillProps) {
  // Auto-detect variant based on common status strings if not explicitly provided
  const detectedVariant: StatusPillVariant = variant ?? (
    value.toLowerCase() === "healthy" ? "healthy" :
    value.toLowerCase() === "warning" ? "warning" :
    value.toLowerCase() === "critical" ? "critical" :
    value.toLowerCase() === "active" ? "active" :
    value.toLowerCase() === "resolved" ? "resolved" :
    "default"
  );

  return (
    <Badge className={cn("uppercase tracking-wider text-[10px] font-bold py-0 h-5", variantStyles[detectedVariant], className)}>
      {value}
    </Badge>
  );
}

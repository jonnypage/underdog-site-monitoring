import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Background, border, and text colors aligned with `SiteStatusBadge` (site list status column). */
export function siteStatusSurfaceClassName(status: string) {
  return cn(
    status === "healthy" && "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950",
    status === "warning" && "border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950",
    status === "critical" && "border-red-200 bg-red-50 text-red-700 dark:bg-red-950",
    status !== "healthy" && status !== "warning" && status !== "critical" && "border-border bg-muted/80 text-foreground"
  );
}

export function SiteStatusBadge({ status }: { status: "healthy" | "warning" | "critical" | string }) {
  return <Badge className={siteStatusSurfaceClassName(status)}>{status}</Badge>;
}

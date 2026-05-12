"use client";

import * as LucideIcons from "lucide-react";
import { cn } from "@/lib/utils";

type LucideIconComponent = React.ComponentType<{ className?: string }>;

function getLucideIcon(name: string | null | undefined): LucideIconComponent | null {
  if (!name) return null;
  // Normalise: strip spaces, PascalCase
  const key = name
    .trim()
    .replace(/[-_\s]+(.)/g, (_, c: string) => c.toUpperCase())
    .replace(/^(.)/, (c: string) => c.toUpperCase());
  const icon = (LucideIcons as Record<string, unknown>)[key];
  
  if (!icon) return null;
  // Lucide icons can be plain functions OR React.forwardRef objects (has $$typeof)
  if (typeof icon === "function") return icon as LucideIconComponent;
  if (typeof icon === "object" && "$$typeof" in (icon as object)) return icon as LucideIconComponent;
  
  return null;
}

export function SensorIcon({ 
  name, 
  className = "h-4 w-4",
  fallback: Fallback
}: { 
  name?: string | null; 
  className?: string;
  fallback?: LucideIconComponent;
}) {
  const Icon = getLucideIcon(name);
  if (!Icon) {
    return Fallback ? <Fallback className={className} /> : null;
  }
  return <Icon className={cn(className)} />;
}

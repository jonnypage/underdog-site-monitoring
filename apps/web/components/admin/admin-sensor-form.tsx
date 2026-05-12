"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import * as LucideIcons from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { apolloErrorMessage } from "@/lib/apollo-error-message";
import { AdminSensorCatalogListDocument } from "@/lib/gql/generated/graphql";
import type { AdminSensorCatalogListQuery } from "@/lib/gql/generated/graphql";
import {
  useCreateSensorCatalogEntry,
  useUpdateSensorCatalogEntry,
} from "@/lib/useAPI";

export type SensorCatalogRow = AdminSensorCatalogListQuery["sensorCatalog"][number];

type LucideIconComponent = React.ComponentType<{ className?: string }>;

function getLucideIcon(name: string | null | undefined): LucideIconComponent | null {
  if (!name) return null;
  const key = name
    .trim()
    .replace(/[-_\s]+(.)/g, (_, c: string) => c.toUpperCase())
    .replace(/^(.)/, (c: string) => c.toUpperCase());
  const icon = (LucideIcons as Record<string, unknown>)[key];
  if (!icon) return null;
  if (typeof icon === "function") return icon as LucideIconComponent;
  if (typeof icon === "object" && "$$typeof" in (icon as object)) return icon as LucideIconComponent;
  return null;
}

function SensorIcon({ name, className = "h-4 w-4" }: { name?: string | null; className?: string }) {
  const Icon = getLucideIcon(name);
  if (!Icon) return null;
  return <Icon className={className} />;
}

const ICON_SUGGESTIONS = [
  "Thermometer",
  "Waves",
  "FlaskConical",
  "Wind",
  "Droplets",
  "Activity",
  "Gauge",
  "Fish",
  "Zap",
  "Leaf",
  "Sun",
  "Signal",
];

function parseOptionalNumber(label: string, raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n)) {
    throw new Error(`${label} must be a valid number or left blank.`);
  }
  return n;
}

function parseOptionalSortOrder(raw: string): number | undefined {
  const t = raw.trim();
  if (t === "") return undefined;
  const n = Number(t);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new Error("Sort order must be a whole number or left blank for auto.");
  }
  return n;
}

const refetchCatalog = {
  refetchQueries: [AdminSensorCatalogListDocument],
  awaitRefetchQueries: true as const,
};

type AdminSensorFormProps = {
  mode: "create" | "edit";
  /** Required when mode is `"edit"` — caller resolves the row from the catalog. */
  catalogEntry?: SensorCatalogRow;
};

export function AdminSensorForm({ mode, catalogEntry }: AdminSensorFormProps) {
  const router = useRouter();
  const editingId = mode === "edit" ? catalogEntry?.id ?? null : null;

  const [createEntry, { loading: creating }] = useCreateSensorCatalogEntry();
  const [updateEntry, { loading: updating }] = useUpdateSensorCatalogEntry();

  const [formErr, setFormErr] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [unitInput, setUnitInput] = useState("");
  const [minInput, setMinInput] = useState("");
  const [maxInput, setMaxInput] = useState("");
  const [sortInput, setSortInput] = useState("");
  const [iconInput, setIconInput] = useState("");

  const resetEmpty = useCallback(() => {
    setKeyInput("");
    setDisplayNameInput("");
    setUnitInput("");
    setMinInput("");
    setMaxInput("");
    setSortInput("");
    setIconInput("");
    setFormErr(null);
  }, []);

  useEffect(() => {
    if (mode !== "edit" || !catalogEntry) return;
    setFormErr(null);
    setKeyInput(catalogEntry.key);
    setDisplayNameInput(catalogEntry.displayName);
    setUnitInput(catalogEntry.unit);
    setMinInput(catalogEntry.physicalMin != null ? String(catalogEntry.physicalMin) : "");
    setMaxInput(catalogEntry.physicalMax != null ? String(catalogEntry.physicalMax) : "");
    setSortInput(String(catalogEntry.sortOrder));
    setIconInput(catalogEntry.icon ?? "");
  }, [mode, catalogEntry]);

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setFormErr(null);
    try {
      const physicalMin = parseOptionalNumber("Typical minimum", minInput);
      const physicalMax = parseOptionalNumber("Typical maximum", maxInput);
      if (physicalMin != null && physicalMax != null && physicalMin > physicalMax) {
        setFormErr("Typical minimum must be less than or equal to typical maximum.");
        return;
      }

      const iconValue = iconInput.trim() || null;

      if (mode === "edit" && editingId) {
        const sortOrder = parseOptionalSortOrder(sortInput);
        await updateEntry({
          ...refetchCatalog,
          variables: {
            input: {
              id: editingId,
              displayName: displayNameInput.trim(),
              unit: unitInput.trim(),
              physicalMin,
              physicalMax,
              icon: iconValue,
              ...(sortOrder !== undefined ? { sortOrder } : {}),
            },
          },
        });
      } else {
        const k = keyInput.trim();
        if (!k) {
          setFormErr("Sensor key is required.");
          return;
        }
        const sortOrder = parseOptionalSortOrder(sortInput);
        await createEntry({
          ...refetchCatalog,
          variables: {
            input: {
              key: k,
              displayName: displayNameInput.trim(),
              unit: unitInput.trim(),
              physicalMin,
              physicalMax,
              icon: iconValue,
              ...(sortOrder !== undefined ? { sortOrder } : {}),
            },
          },
        });
      }
      router.push("/admin/sensors");
      router.refresh();
    } catch (err) {
      setFormErr(apolloErrorMessage(err));
    }
  }

  const busy = creating || updating;
  const previewIcon = getLucideIcon(iconInput);

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>{mode === "edit" ? "Edit sensor" : "Add sensor"}</CardTitle>
        <p className="text-sm text-muted-foreground">
          The <span className="font-medium">key</span> is sent by devices in ingest JSON (camelCase, letters/numbers/underscores). It
          cannot be changed after creation. Typical min/max are used for UI hints and anomaly defaults where implemented.
        </p>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submitForm}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium" htmlFor="sensor-key">
                Key {mode === "edit" ? "(fixed)" : ""}
              </label>
              <Input
                id="sensor-key"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                disabled={mode === "edit"}
                placeholder="e.g. dissolvedOxygen"
                required={mode === "create"}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="sensor-display">
                Display name
              </label>
              <Input
                id="sensor-display"
                value={displayNameInput}
                onChange={(e) => setDisplayNameInput(e.target.value)}
                placeholder="e.g. Dissolved oxygen"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="sensor-unit">
                Unit
              </label>
              <Input
                id="sensor-unit"
                value={unitInput}
                onChange={(e) => setUnitInput(e.target.value)}
                placeholder="e.g. mg/L"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="sensor-min">
                Typical minimum (optional)
              </label>
              <Input
                id="sensor-min"
                type="text"
                inputMode="decimal"
                value={minInput}
                onChange={(e) => setMinInput(e.target.value)}
                placeholder="Leave blank if unknown"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="sensor-max">
                Typical maximum (optional)
              </label>
              <Input
                id="sensor-max"
                type="text"
                inputMode="decimal"
                value={maxInput}
                onChange={(e) => setMaxInput(e.target.value)}
                placeholder="Leave blank if unknown"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="sensor-sort">
                Sort order
              </label>
              <Input
                id="sensor-sort"
                type="text"
                inputMode="numeric"
                value={sortInput}
                onChange={(e) => setSortInput(e.target.value)}
                placeholder={mode === "edit" ? "Display order (integer)" : "Leave blank to append last"}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <label className="text-sm font-medium" htmlFor="sensor-icon">
                Icon{" "}
                <span className="font-normal text-muted-foreground">
                  — Lucide icon name (PascalCase, e.g.{" "}
                  <code className="rounded bg-muted px-1 font-mono text-xs">Thermometer</code>)
                </span>
              </label>

              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Input
                    id="sensor-icon"
                    value={iconInput}
                    onChange={(e) => setIconInput(e.target.value)}
                    placeholder="e.g. Thermometer"
                    className={previewIcon ? "pr-10" : ""}
                  />
                  {previewIcon ? (
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground">
                      <SensorIcon name={iconInput} className="h-4 w-4" />
                    </span>
                  ) : null}
                </div>
                {previewIcon ? (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted">
                    <SensorIcon name={iconInput} className="h-5 w-5" />
                  </div>
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
                    ?
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {ICON_SUGGESTIONS.map((name) => {
                  const Icon = getLucideIcon(name);
                  return (
                    <button
                      key={name}
                      type="button"
                      title={name}
                      onClick={() => setIconInput(name)}
                      className={`flex items-center gap-1 rounded border px-2 py-1 text-xs transition-colors hover:bg-accent hover:text-accent-foreground ${
                        iconInput === name
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                      {name}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Browse all icons at{" "}
                <a
                  href="https://lucide.dev/icons/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2"
                >
                  lucide.dev/icons
                </a>
                . Type the exact icon name — it will preview instantly.
              </p>
            </div>
          </div>

          {formErr ? <p className="text-sm text-red-600">{formErr}</p> : null}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy} className="gap-2">
              {mode === "edit" ? (
                updating ? (
                  <>
                    <Spinner className="text-primary-foreground" size="md" />
                    Saving…
                  </>
                ) : (
                  "Save changes"
                )
              ) : creating ? (
                <>
                  <Spinner className="text-primary-foreground" size="md" />
                  Adding…
                </>
              ) : (
                "Add sensor"
              )}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/admin/sensors">Cancel</Link>
            </Button>
            {mode === "create" ? (
              <Button type="button" variant="ghost" onClick={resetEmpty} disabled={busy}>
                Clear form
              </Button>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

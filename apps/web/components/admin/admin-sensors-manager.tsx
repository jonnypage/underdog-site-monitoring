"use client";

import { useMutation, useQuery } from "@apollo/client";
import Link from "next/link";
import { useCallback, useState } from "react";
import * as LucideIcons from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LoadingMessage, Spinner } from "@/components/ui/spinner";
import { apolloErrorMessage } from "@/lib/apollo-error-message";
import {
  AdminSensorCatalogListDocument,
  CreateSensorCatalogEntryDocument,
  DeleteSensorCatalogEntryDocument,
  UpdateSensorCatalogEntryDocument
} from "@/lib/gql/generated/graphql";

// ── Lucide icon resolver ───────────────────────────────────────────────────
// Icons are PascalCase in the library (e.g. "Thermometer", "Droplets").
// We accept that exact name from the text field.

type LucideIconComponent = React.ComponentType<{ className?: string }>;

function getLucideIcon(name: string | null | undefined): LucideIconComponent | null {
  if (!name) return null;
  // Normalise: strip spaces, PascalCase
  const key = name
    .trim()
    .replace(/[-_\s]+(.)/g, (_, c: string) => c.toUpperCase())
    .replace(/^(.)/, (c: string) => c.toUpperCase());
  const icon = (LucideIcons as Record<string, unknown>)[key];
  // Lucide icons can be plain functions OR React.forwardRef objects (has $$typeof)
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

// ── Suggestions pulled from common aquaponics / IoT sensor icons ───────────
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

// ── Helpers ────────────────────────────────────────────────────────────────

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

// ── Component ──────────────────────────────────────────────────────────────

export function AdminSensorsManager() {
  const { data, loading, error, refetch } = useQuery(AdminSensorCatalogListDocument);
  const [createEntry, { loading: creating }] = useMutation(CreateSensorCatalogEntryDocument);
  const [updateEntry, { loading: updating }] = useMutation(UpdateSensorCatalogEntryDocument);
  const [deleteEntry, { loading: deleting }] = useMutation(DeleteSensorCatalogEntryDocument);

  const rows = data?.sensorCatalog ?? [];

  const [formErr, setFormErr] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [keyInput, setKeyInput] = useState("");
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [unitInput, setUnitInput] = useState("");
  const [minInput, setMinInput] = useState("");
  const [maxInput, setMaxInput] = useState("");
  const [sortInput, setSortInput] = useState("");
  const [iconInput, setIconInput] = useState("");

  const resetForm = useCallback(() => {
    setEditingId(null);
    setKeyInput("");
    setDisplayNameInput("");
    setUnitInput("");
    setMinInput("");
    setMaxInput("");
    setSortInput("");
    setIconInput("");
    setFormErr(null);
  }, []);

  const startCreate = () => {
    resetForm();
    setEditingId(null);
  };

  const startEdit = (row: (typeof rows)[number]) => {
    setFormErr(null);
    setEditingId(row.id);
    setKeyInput(row.key);
    setDisplayNameInput(row.displayName);
    setUnitInput(row.unit);
    setMinInput(row.physicalMin != null ? String(row.physicalMin) : "");
    setMaxInput(row.physicalMax != null ? String(row.physicalMax) : "");
    setSortInput(String(row.sortOrder));
    setIconInput(row.icon ?? "");
  };

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

      if (editingId) {
        const sortOrder = parseOptionalSortOrder(sortInput);
        await updateEntry({
          variables: {
            input: {
              id: editingId,
              displayName: displayNameInput.trim(),
              unit: unitInput.trim(),
              physicalMin,
              physicalMax,
              icon: iconValue,
              ...(sortOrder !== undefined ? { sortOrder } : {})
            }
          }
        });
      } else {
        const k = keyInput.trim();
        if (!k) {
          setFormErr("Sensor key is required.");
          return;
        }
        const sortOrder = parseOptionalSortOrder(sortInput);
        await createEntry({
          variables: {
            input: {
              key: k,
              displayName: displayNameInput.trim(),
              unit: unitInput.trim(),
              physicalMin,
              physicalMax,
              icon: iconValue,
              ...(sortOrder !== undefined ? { sortOrder } : {})
            }
          }
        });
      }
      await refetch();
      resetForm();
    } catch (err) {
      setFormErr(apolloErrorMessage(err));
    }
  }

  async function onDelete(id: string, key: string) {
    if (
      !window.confirm(
        `Remove sensor "${key}" from the catalog? It will disappear from dashboards and site settings. Historical measurements that used this key may still exist in the database.`
      )
    ) {
      return;
    }
    setFormErr(null);
    try {
      await deleteEntry({ variables: { id } });
      await refetch();
      if (editingId === id) resetForm();
    } catch (err) {
      setFormErr(apolloErrorMessage(err));
    }
  }

  const busy = creating || updating || deleting;
  const previewIcon = getLucideIcon(iconInput);

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Edit sensor" : "Add sensor"}</CardTitle>
          <p className="text-sm text-muted-foreground">
            The <span className="font-medium">key</span> is sent by devices in ingest JSON (camelCase,
            letters/numbers/underscores). It cannot be changed after creation. Typical min/max are used
            for UI hints and anomaly defaults where implemented.
          </p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submitForm}>
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Key */}
              <div className="space-y-2 sm:col-span-2">
                <label className="text-sm font-medium" htmlFor="sensor-key">
                  Key {editingId ? "(fixed)" : ""}
                </label>
                <Input
                  id="sensor-key"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  disabled={!!editingId}
                  placeholder="e.g. dissolvedOxygen"
                  required={!editingId}
                />
              </div>

              {/* Display name */}
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

              {/* Unit */}
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

              {/* Typical min */}
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

              {/* Typical max */}
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

              {/* Sort order */}
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
                  placeholder={editingId ? "Display order (integer)" : "Leave blank to append last"}
                />
              </div>

              {/* Icon picker */}
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
                    {previewIcon && (
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground">
                        <SensorIcon name={iconInput} className="h-4 w-4" />
                      </span>
                    )}
                  </div>
                  {/* Live preview badge */}
                  {previewIcon ? (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted">
                      <SensorIcon name={iconInput} className="h-5 w-5" />
                    </div>
                  ) : (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground text-xs">
                      ?
                    </div>
                  )}
                </div>

                {/* Quick suggestions */}
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
                        {Icon && <Icon className="h-3.5 w-3.5" />}
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
                {editingId ? (
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
              {editingId ? (
                <Button type="button" variant="outline" onClick={resetForm} disabled={busy}>
                  Cancel edit
                </Button>
              ) : null}
              {!editingId ? (
                <Button type="button" variant="ghost" onClick={startCreate} disabled={busy}>
                  Clear form
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All sensors</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? <p className="text-sm text-red-600">{error.message}</p> : null}
          {loading ? <LoadingMessage>Loading…</LoadingMessage> : null}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-3 pr-4">Order</th>
                  <th className="py-3 pr-4">Icon</th>
                  <th className="py-3 pr-4">Key</th>
                  <th className="py-3 pr-4">Name</th>
                  <th className="py-3 pr-4">Unit</th>
                  <th className="py-3 pr-4">Typical range</th>
                  <th className="py-3 pr-4" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="py-3 pr-4 text-muted-foreground">{r.sortOrder}</td>
                    <td className="py-3 pr-4">
                      {r.icon ? (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <SensorIcon name={r.icon} className="h-4 w-4" />
                          <span className="font-mono text-xs">{r.icon}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs">{r.key}</td>
                    <td className="py-3 pr-4 font-medium">{r.displayName}</td>
                    <td className="py-3 pr-4">{r.unit}</td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {r.physicalMin != null && r.physicalMax != null
                        ? `${r.physicalMin} – ${r.physicalMax}`
                        : "—"}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button type="button" size="sm" variant="ghost" onClick={() => startEdit(r)} disabled={busy}>
                          Edit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-red-600"
                          onClick={() => onDelete(r.id, r.key)}
                          disabled={busy}
                        >
                          Remove
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        <Link className="text-primary underline" href="/admin">
          ← Back to admin
        </Link>
      </p>
    </div>
  );
}

"use client";

import { useMutation, useQuery } from "@apollo/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AdminSiteMapPicker } from "@/components/admin/admin-site-map-picker";
import { apolloErrorMessage } from "@/lib/apollo-error-message";
import {
  AdminSitesDocument,
  CreateAdminSiteDocument,
  GetSiteDocument,
  GetSitesDocument,
  UpdateAdminSiteDocument,
  AdminDevicesDocument
} from "@/lib/gql/generated/graphql";

type Mode = "create" | "edit";

export function AdminSiteForm({ mode, siteId }: { mode: Mode; siteId?: string }) {
  const router = useRouter();
  const { data: sitesData, loading: sitesLoading } = useQuery(AdminSitesDocument);
  const [createSite, { loading: creatingSite }] = useMutation(CreateAdminSiteDocument);
  const [updateSite, { loading: updatingSite }] = useMutation(UpdateAdminSiteDocument);

  const catalog = sitesData?.sensorCatalog ?? [];
  const sites = sitesData?.adminSites ?? [];
  const { data: devicesData, loading: devicesLoading } = useQuery(AdminDevicesDocument);
  const allDevices = devicesData?.adminDevices ?? [];
  const existing = mode === "edit" && siteId ? sites.find((s) => s.id === siteId) : undefined;
  
  const availableDevices = allDevices.filter(d => d.siteId == null || d.siteId === siteId);

  const [sName, setSName] = useState("");
  const [sLat, setSLat] = useState("");
  const [sLng, setSLng] = useState("");
  const [sSensorEnabled, setSSensorEnabled] = useState<Record<string, boolean>>({});
  const [sThresholdMin, setSThresholdMin] = useState<Record<string, string>>({});
  const [sThresholdMax, setSThresholdMax] = useState<Record<string, string>>({});
  const [siteErr, setSiteErr] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [sDeviceId, setSDeviceId] = useState("");

  useEffect(() => {
    if (catalog.length === 0) return;
    if (mode === "create") {
      setSSensorEnabled(Object.fromEntries(catalog.map((c) => [c.key, true])));
      setSThresholdMin(Object.fromEntries(catalog.map((c) => [c.key, ""])));
      setSThresholdMax(Object.fromEntries(catalog.map((c) => [c.key, ""])));
      setHydrated(true);
      return;
    }
    if (mode === "edit" && existing) {
      const next: Record<string, boolean> = Object.fromEntries(catalog.map((c) => [c.key, true]));
      const minM: Record<string, string> = Object.fromEntries(catalog.map((c) => [c.key, ""]));
      const maxM: Record<string, string> = Object.fromEntries(catalog.map((c) => [c.key, ""]));
      for (const r of existing.sensorReporting ?? []) {
        next[r.key] = r.enabled;
        minM[r.key] = r.thresholdMinOverride != null ? String(r.thresholdMinOverride) : "";
        maxM[r.key] = r.thresholdMaxOverride != null ? String(r.thresholdMaxOverride) : "";
      }
      setSSensorEnabled(next);
      setSThresholdMin(minM);
      setSThresholdMax(maxM);
      setHydrated(true);
    }
  }, [mode, existing, catalog]);

  useEffect(() => {
    if (mode !== "edit" || !existing) return;
    setSName(existing.name);
    setSLat(existing.latitude != null ? String(existing.latitude) : "");
    setSLng(existing.longitude != null ? String(existing.longitude) : "");
    const assignedDevice = allDevices.find(d => d.siteId === siteId);
    if (assignedDevice) {
      setSDeviceId(assignedDevice.id);
    }
  }, [mode, existing, allDevices, siteId]);

  async function submitSite(event: React.FormEvent) {
    event.preventDefault();
    setSiteErr(null);
    if (catalog.length === 0) {
      setSiteErr("Sensor catalog is not available yet.");
      return;
    }
    const sensorReporting = catalog.map((c) => ({
      key: c.key,
      enabled: sSensorEnabled[c.key] !== false
    }));

    const sensorThresholds = catalog.map((c) => {
      const minStr = (sThresholdMin[c.key] ?? "").trim();
      const maxStr = (sThresholdMax[c.key] ?? "").trim();
      return {
        key: c.key,
        minValue: minStr === "" ? null : Number(minStr),
        maxValue: maxStr === "" ? null : Number(maxStr)
      };
    });
    for (const t of sensorThresholds) {
      if (t.minValue != null && !Number.isFinite(t.minValue)) {
        setSiteErr(`Invalid minimum threshold for ${t.key}.`);
        return;
      }
      if (t.maxValue != null && !Number.isFinite(t.maxValue)) {
        setSiteErr(`Invalid maximum threshold for ${t.key}.`);
        return;
      }
      if (t.minValue != null && t.maxValue != null && t.minValue > t.maxValue) {
        setSiteErr(`Threshold minimum must be ≤ maximum for ${t.key}.`);
        return;
      }
    }
    const latStr = sLat.trim();
    const lngStr = sLng.trim();
    if ((latStr === "") !== (lngStr === "")) {
      setSiteErr("Enter both latitude and longitude, or leave both empty.");
      return;
    }
    let latitude: number | null | undefined;
    let longitude: number | null | undefined;
    if (latStr !== "" && lngStr !== "") {
      const lat = Number(latStr);
      const lng = Number(lngStr);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        setSiteErr("Latitude and longitude must be valid numbers.");
        return;
      }
      latitude = lat;
      longitude = lng;
    } else if (mode === "edit") {
      latitude = null;
      longitude = null;
    }
    try {
      if (mode === "create") {
        await createSite({
          variables: {
            input: {
              name: sName.trim(),
              location: null,
              ...(latitude !== undefined && longitude !== undefined ? { latitude, longitude } : {}),
              sensorReporting,
              sensorThresholds,
              deviceId: sDeviceId || null
            }
          },
          refetchQueries: [GetSitesDocument, AdminSitesDocument, AdminDevicesDocument],
          awaitRefetchQueries: true
        });
      } else if (mode === "edit" && siteId) {
        await updateSite({
          variables: {
            input: {
              id: siteId,
              name: sName.trim(),
              location: null,
              latitude: latitude ?? null,
              longitude: longitude ?? null,
              sensorReporting,
              sensorThresholds,
              deviceId: sDeviceId || null
            }
          },
          refetchQueries: [
            GetSitesDocument,
            AdminSitesDocument,
            AdminDevicesDocument,
            { query: GetSiteDocument, variables: { id: siteId } }
          ],
          awaitRefetchQueries: true
        });
      }
      router.push("/admin");
      router.refresh();
    } catch (err) {
      setSiteErr(apolloErrorMessage(err));
    }
  }

  if (mode === "edit") {
    if (sitesLoading || !sitesData) {
      return <p className="text-sm text-muted-foreground">Loading site…</p>;
    }
    if (!existing) {
      return (
        <div className="space-y-4">
          <p className="text-sm text-red-600">Site not found.</p>
          <Button type="button" variant="outline" asChild>
            <Link href="/admin">Back to admin</Link>
          </Button>
        </div>
      );
    }
    if (!hydrated) {
      return <p className="text-sm text-muted-foreground">Loading site…</p>;
    }
  }

  if (mode === "create" && (sitesLoading || !hydrated)) {
    return <p className="text-sm text-muted-foreground">Loading sensor catalog…</p>;
  }

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>{mode === "create" ? "New site" : "Edit site"}</CardTitle>
        <p className="text-sm text-muted-foreground">
          <Link className="text-primary underline" href="/admin">
            ← Back to admin
          </Link>
        </p>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submitSite}>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="admin-s-name">
              Name
            </label>
            <Input id="admin-s-name" required value={sName} onChange={(e) => setSName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="admin-s-device">
              Monitoring Device (optional)
            </label>
            <select
              id="admin-s-device"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={sDeviceId}
              onChange={(e) => setSDeviceId(e.target.value)}
            >
              <option value="">None (Unassigned)</option>
              {availableDevices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name ? `${d.name} (${d.deviceId})` : d.deviceId}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="admin-s-lat">
                Latitude (optional)
              </label>
              <Input
                id="admin-s-lat"
                type="text"
                inputMode="decimal"
                placeholder="e.g. 49.2827"
                value={sLat}
                onChange={(e) => setSLat(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="admin-s-lng">
                Longitude (optional)
              </label>
              <Input
                id="admin-s-lng"
                type="text"
                inputMode="decimal"
                placeholder="e.g. -123.1207"
                value={sLng}
                onChange={(e) => setSLng(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Map</p>
            <AdminSiteMapPicker
              latStr={sLat}
              lngStr={sLng}
              onLatLngChange={(lat, lng) => {
                setSLat(lat);
                setSLng(lng);
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            GPS is used for the site map on the dashboard. Edit latitude and longitude above or use the map. Leave both fields blank to clear saved coordinates when editing.
          </p>
          <div className="space-y-2">
            <p className="text-sm font-medium">Sensors</p>
            <p className="text-xs text-muted-foreground">
              Disabled sensors are hidden in the dashboard and do not generate anomaly alerts. Measurements for disabled channels may still be stored if the device sends them.
            </p>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Alert range</span> defaults to the global catalog “typical” min/max. Leave override fields blank to use those defaults; set a value only when this site needs tighter or wider critical bounds.
            </p>
            <ul className="space-y-4 rounded-md border border-border p-3">
              {catalog.map((c) => {
                const rangeHint =
                  c.physicalMin != null && c.physicalMax != null
                    ? `Catalog default ${c.physicalMin}–${c.physicalMax} ${c.unit}`
                    : "No catalog default range — set overrides if needed.";
                return (
                  <li key={c.key} className="border-b border-border pb-4 last:border-0 last:pb-0">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          id={`sensor-${c.key}`}
                          checked={sSensorEnabled[c.key] !== false}
                          onChange={() =>
                            setSSensorEnabled((prev) => ({
                              ...prev,
                              [c.key]: !(prev[c.key] !== false)
                            }))
                          }
                          className="mt-0.5 rounded border-border"
                        />
                        <label htmlFor={`sensor-${c.key}`} className="cursor-pointer font-medium leading-snug">
                          {c.displayName}
                          <span className="font-normal text-muted-foreground"> ({c.unit})</span>
                        </label>
                      </div>
                      <p className="pl-6 text-xs text-muted-foreground sm:pl-0 sm:text-right">{rangeHint}</p>
                    </div>
                    <div className="mt-2 grid gap-2 pl-6 sm:grid-cols-2 sm:pl-8">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground" htmlFor={`thr-min-${c.key}`}>
                          Site min override
                        </label>
                        <Input
                          id={`thr-min-${c.key}`}
                          type="text"
                          inputMode="decimal"
                          placeholder="Catalog default"
                          value={sThresholdMin[c.key] ?? ""}
                          onChange={(e) =>
                            setSThresholdMin((prev) => ({
                              ...prev,
                              [c.key]: e.target.value
                            }))
                          }
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground" htmlFor={`thr-max-${c.key}`}>
                          Site max override
                        </label>
                        <Input
                          id={`thr-max-${c.key}`}
                          type="text"
                          inputMode="decimal"
                          placeholder="Catalog default"
                          value={sThresholdMax[c.key] ?? ""}
                          onChange={(e) =>
                            setSThresholdMax((prev) => ({
                              ...prev,
                              [c.key]: e.target.value
                            }))
                          }
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
          {siteErr ? <p className="text-sm text-red-600">{siteErr}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={creatingSite || updatingSite || catalog.length === 0}>
              {mode === "create" ? (creatingSite ? "Creating…" : "Create site") : updatingSite ? "Saving…" : "Save site"}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/admin">Cancel</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

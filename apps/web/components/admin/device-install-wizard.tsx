"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { apolloErrorMessage } from "@/lib/apollo-error-message";
import {
  AdminDeviceDocument,
  GetSiteDocument,
  RotateAdminDeviceApiKeyDocument,
  UpdateAdminDeviceDocument
} from "@/lib/gql/generated/graphql";
import {
  BOARDS,
  defaultDriverForSensor,
  type BoardDefinition,
  type DriverDefinition
} from "@/lib/firmware/boards";
import {
  buildConfigJson,
  buildEspWebToolsManifest,
  patchFirmwareBinary,
  type ConfiguredSensor
} from "@/lib/firmware/patch-config";

interface SensorRow {
  key: string;
  displayName: string;
  unit: string;
  enabled: boolean;
  driverKey: string;
  pins: Record<string, number>;
  cal: { slope?: number; intercept?: number };
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "esp-web-install-button": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & { manifest?: string },
        HTMLElement
      >;
    }
  }
}

export function DeviceInstallWizard({
  deviceUuid,
  apiBaseUrl
}: {
  deviceUuid: string;
  apiBaseUrl: string;
}) {
  const { data, loading, error: deviceErr } = useQuery(AdminDeviceDocument, {
    variables: { id: deviceUuid }
  });
  const device = data?.adminDevice;

  const { data: siteData, loading: siteLoading } = useQuery(GetSiteDocument, {
    variables: { id: device?.siteId ?? "" },
    skip: !device?.siteId
  });

  const [rotateKey, { loading: rotating }] = useMutation(RotateAdminDeviceApiKeyDocument);
  const [updateDevice] = useMutation(UpdateAdminDeviceDocument);

  const board: BoardDefinition | undefined = useMemo(() => {
    const id = device?.board ?? "wemos_d1_mini";
    return BOARDS.find((b) => b.id === id) ?? BOARDS[0];
  }, [device?.board]);

  const [wifiSsid, setWifiSsid] = useState("");
  const [wifiPass, setWifiPass] = useState("");
  const [apiUrl, setApiUrl] = useState(apiBaseUrl);
  const [apiKey, setApiKey] = useState("");
  const [interval, setInterval] = useState(300);
  const [sensors, setSensors] = useState<SensorRow[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [supportsWebSerial, setSupportsWebSerial] = useState<boolean | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const [manifestUrl, setManifestUrl] = useState<string | null>(null);
  const revokeRef = useRef<(() => void) | null>(null);
  const buttonRef = useRef<HTMLElement | null>(null);

  // One-time hydration from server data: pin defaults come from the board, but
  // any previously-saved pin_map on the device wins so a re-install does not
  // forget the wiring.
  useEffect(() => {
    if (hydrated || !device || !siteData?.getSite || !board) return;
    setInterval(device.expectedIntervalSeconds);

    const next: SensorRow[] = [];
    const reporting = siteData.getSite.sensorReporting ?? [];
    const previous = (device.pinMap ?? {}) as Record<
      string,
      { driver?: string; pins?: Record<string, number>; cal?: { slope?: number; intercept?: number } }
    > | null;

    for (const r of reporting) {
      const driverKey =
        previous?.[r.key]?.driver ?? defaultDriverForSensor(r.key) ?? board.drivers[0]?.key ?? "";
      const driver = board.drivers.find((d) => d.key === driverKey);
      const pins = previous?.[r.key]?.pins ?? driver?.defaults ?? {};
      const cal = previous?.[r.key]?.cal ?? {
        slope: driver?.cal?.slope?.defaultValue,
        intercept: driver?.cal?.intercept?.defaultValue
      };
      next.push({
        key: r.key,
        displayName: r.displayName,
        unit: r.unit,
        enabled: r.enabled,
        driverKey,
        pins: { ...pins },
        cal: { ...cal }
      });
    }

    setSensors(next);
    setHydrated(true);
  }, [hydrated, device, siteData, board]);

  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setSupportsWebSerial("serial" in navigator);
    }
  }, []);

  // Re-attach the manifest URL to the install button whenever it changes.
  useEffect(() => {
    if (manifestUrl && buttonRef.current) {
      buttonRef.current.setAttribute("manifest", manifestUrl);
    }
  }, [manifestUrl]);

  // Free Blob URLs on unmount.
  useEffect(() => {
    return () => {
      if (revokeRef.current) revokeRef.current();
    };
  }, []);

  function updateSensor(idx: number, patch: Partial<SensorRow>) {
    setSensors((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  function updateSensorPin(idx: number, pinName: string, gpio: number) {
    setSensors((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, pins: { ...s.pins, [pinName]: gpio } } : s))
    );
  }

  function updateSensorCal(idx: number, key: "slope" | "intercept", value: number | undefined) {
    setSensors((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, cal: { ...s.cal, [key]: value } } : s))
    );
  }

  function changeDriver(idx: number, driverKey: string) {
    if (!board) return;
    const driver = board.drivers.find((d) => d.key === driverKey);
    if (!driver) return;
    setSensors((prev) =>
      prev.map((s, i) =>
        i === idx
          ? {
              ...s,
              driverKey,
              pins: { ...driver.defaults },
              cal: {
                slope: driver.cal?.slope?.defaultValue,
                intercept: driver.cal?.intercept?.defaultValue
              }
            }
          : s
      )
    );
  }

  async function onGenerateNewKey() {
    setError(null);
    if (!confirm("Rotate the API key now? The previous key stops working immediately.")) return;
    try {
      const r = await rotateKey({ variables: { id: deviceUuid } });
      const next = r.data?.rotateAdminDeviceApiKey;
      if (next) setApiKey(next);
    } catch (err) {
      setError(apolloErrorMessage(err));
    }
  }

  async function onPrepareFlash(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!device || !board) return;
    if (!wifiSsid.trim()) {
      setError("Wi-Fi SSID is required.");
      return;
    }
    if (!apiUrl.trim()) {
      setError("API base URL is required.");
      return;
    }
    if (!apiKey.trim()) {
      setError('API key is required. Use "Generate new API key" if you do not have it.');
      return;
    }
    const enabled = sensors.filter((s) => s.enabled);
    if (enabled.length === 0) {
      setError("Enable at least one sensor for the device to post.");
      return;
    }

    setBuilding(true);
    if (revokeRef.current) {
      revokeRef.current();
      revokeRef.current = null;
    }
    setManifestUrl(null);

    try {
      const configured: ConfiguredSensor[] = enabled.map((s) => ({
        key: s.key,
        driver: s.driverKey,
        pins: s.pins,
        cal:
          s.cal.slope !== undefined || s.cal.intercept !== undefined
            ? { slope: s.cal.slope, intercept: s.cal.intercept }
            : undefined
      }));

      const json = buildConfigJson({
        wifi: { ssid: wifiSsid, pass: wifiPass },
        api: { baseUrl: apiUrl.trim(), deviceId: device.deviceId, apiKey: apiKey.trim() },
        intervalSeconds: interval,
        sensors: configured
      });

      const res = await fetch(board.firmwarePath);
      if (!res.ok) {
        throw new Error(`Failed to fetch ${board.firmwarePath} (${res.status}). Did you build the firmware and copy the .bin?`);
      }
      const buf = new Uint8Array(await res.arrayBuffer());
      const patched = patchFirmwareBinary(buf, json);

      const built = buildEspWebToolsManifest({
        patched,
        chipFamily: board.chipFamily,
        name: "Underdog node",
        version: "0.1.0",
        offset: board.flashOffset
      });
      revokeRef.current = built.revoke;
      setManifestUrl(built.manifestUrl);

      // Persist the chosen sensor→pin map so future installs of this device
      // pre-fill the same wiring.
      const pinMap: Record<string, unknown> = {};
      for (const s of enabled) {
        pinMap[s.key] = {
          driver: s.driverKey,
          pins: s.pins,
          ...(s.cal.slope !== undefined || s.cal.intercept !== undefined
            ? { cal: s.cal }
            : {})
        };
      }
      try {
        await updateDevice({
          variables: {
            input: {
              id: deviceUuid,
              expectedIntervalSeconds: interval,
              board: board.id,
              pinMap
            }
          }
        });
      } catch (err) {
        // Pin-map persist failure should not block the user from flashing.
        console.warn("failed to persist pin map", err);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBuilding(false);
    }
  }

  if (loading || siteLoading || !hydrated) {
    return <p className="text-sm text-muted-foreground">Loading device…</p>;
  }
  if (deviceErr) {
    return <p className="text-sm text-red-600">{deviceErr.message}</p>;
  }
  if (!device || !board) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-600">Device not found.</p>
        <Button type="button" variant="outline" asChild>
          <Link href="/admin/devices">Back to devices</Link>
        </Button>
      </div>
    );
  }

  const analogConflicts = countAnalogConflicts(sensors, board);

  return (
    <>
      <Script
        src="https://unpkg.com/esp-web-tools@10/dist/web/install-button.js?module"
        type="module"
        strategy="afterInteractive"
      />
      <div className="space-y-6">
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-transparent px-6 py-8">
            <p className="text-xs font-medium uppercase tracking-wide text-primary">{board.displayName}</p>
            <h2 className="mt-1 text-2xl font-semibold">{device.name ?? device.deviceId}</h2>
            <p className="text-sm text-muted-foreground">
              Site: {device.siteName} · Device ID: <span className="font-mono">{device.deviceId}</span>
            </p>
            {supportsWebSerial === false ? (
              <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
                Your browser does not support Web Serial. Use Chrome or Edge on a desktop to flash.
              </p>
            ) : null}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Configure firmware</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={onPrepareFlash}>
              <section className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Network</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="wifi-ssid">Wi-Fi SSID</label>
                    <Input id="wifi-ssid" required value={wifiSsid} onChange={(e) => setWifiSsid(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="wifi-pass">Wi-Fi password</label>
                    <Input
                      id="wifi-pass"
                      type="password"
                      value={wifiPass}
                      onChange={(e) => setWifiPass(e.target.value)}
                      autoComplete="off"
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">API</h3>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="api-url">API base URL</label>
                  <Input id="api-url" required value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} placeholder="https://api.example.com" />
                  <p className="text-xs text-muted-foreground">
                    Auto-filled from <code className="font-mono">NEXT_PUBLIC_API_URL</code>; override only if the device should reach the API on a different host.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="api-key">API key</label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="api-key"
                      required
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="ud_…"
                      className="font-mono"
                    />
                    <Button type="button" variant="outline" disabled={rotating} onClick={onGenerateNewKey}>
                      {rotating ? "Rotating…" : "Generate new API key"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    The API key is shown once when generated. The server only stores its SHA-256 hash; if you lose it, rotate a new one here.
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="interval">Post interval (seconds)</label>
                  <Input
                    id="interval"
                    type="number"
                    min={5}
                    value={interval}
                    onChange={(e) => setInterval(Number(e.target.value) || 300)}
                  />
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Sensors</h3>
                <p className="text-xs text-muted-foreground">
                  Enable the sensors physically wired to this device and pick the GPIO pin for each. Defaults match the typical Wemos D1 Mini wiring; override only if you wired something different.
                </p>
                {analogConflicts > 0 ? (
                  <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
                    Multiple analog sensors are mapped to the same ADC pin. The board only has one analog input; only the last sensor read will return a meaningful value.
                  </p>
                ) : null}
                <ul className="space-y-3">
                  {sensors.map((s, idx) => (
                    <li key={s.key} className="rounded-md border border-border p-4">
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          id={`sensor-${s.key}`}
                          checked={s.enabled}
                          onChange={(e) => updateSensor(idx, { enabled: e.target.checked })}
                          className="mt-1 rounded border-border"
                        />
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <label htmlFor={`sensor-${s.key}`} className="cursor-pointer text-sm font-medium">
                              {s.displayName} <span className="font-normal text-muted-foreground">({s.unit})</span>
                            </label>
                            <code className="font-mono text-xs text-muted-foreground">{s.key}</code>
                          </div>
                          {s.enabled ? (
                            <SensorDriverFields
                              board={board}
                              row={s}
                              onDriverChange={(d) => changeDriver(idx, d)}
                              onPinChange={(pinName, gpio) => updateSensorPin(idx, pinName, gpio)}
                              onCalChange={(k, v) => updateSensorCal(idx, k, v)}
                            />
                          ) : null}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                {sensors.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    This site has no sensors enabled. Enable some on the site form first.
                  </p>
                ) : null}
              </section>

              {error ? <p className="text-sm text-red-600">{error}</p> : null}

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={building}>
                  {building ? "Preparing firmware…" : manifestUrl ? "Rebuild firmware" : "Prepare firmware"}
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link href="/admin/devices">Cancel</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {manifestUrl ? (
          <Card>
            <CardHeader>
              <CardTitle>Connect &amp; flash</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Plug the device into a USB port on this computer.</li>
                <li>Click "Connect", pick the matching serial port, and confirm the install.</li>
                <li>When it finishes, the device will reboot, connect to Wi-Fi, and start posting.</li>
              </ol>
              <div>
                <esp-web-install-button
                  ref={(el) => {
                    buttonRef.current = el;
                    if (el && manifestUrl) el.setAttribute("manifest", manifestUrl);
                  }}
                >
                  <Button type="button" slot="activate">Connect &amp; install</Button>
                  <span slot="unsupported" className="text-sm text-amber-700">
                    Your browser does not support Web Serial. Use Chrome or Edge on a desktop.
                  </span>
                  <span slot="not-allowed" className="text-sm text-amber-700">
                    Web Serial requires HTTPS (or localhost).
                  </span>
                </esp-web-install-button>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}

function SensorDriverFields({
  board,
  row,
  onDriverChange,
  onPinChange,
  onCalChange
}: {
  board: BoardDefinition;
  row: SensorRow;
  onDriverChange: (driver: string) => void;
  onPinChange: (pinName: string, gpio: number) => void;
  onCalChange: (key: "slope" | "intercept", value: number | undefined) => void;
}) {
  const driver: DriverDefinition | undefined = board.drivers.find((d) => d.key === row.driverKey);

  return (
    <div className="space-y-3 rounded-md bg-muted/40 p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Driver</label>
          <Select value={row.driverKey} onChange={(e) => onDriverChange(e.target.value)}>
            {board.drivers.map((d) => (
              <option key={d.key} value={d.key}>{d.displayName}</option>
            ))}
          </Select>
        </div>
      </div>
      {driver?.pinSlots && driver.pinSlots.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {driver.pinSlots.map((slot) => {
            const current = row.pins[slot.name] ?? driver.defaults[slot.name] ?? 0;
            return (
              <div key={slot.name} className="space-y-1">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {slot.label} pin
                </label>
                <Select
                  value={String(current)}
                  onChange={(e) => onPinChange(slot.name, Number(e.target.value))}
                >
                  {board.pins
                    .filter((p) => (slot.analog ? p.analog : true))
                    .map((p) => (
                      <option key={p.gpio} value={p.gpio}>
                        {p.label} (GPIO{p.gpio}){p.note ? ` — ${p.note}` : ""}
                      </option>
                    ))}
                </Select>
              </div>
            );
          })}
        </div>
      ) : null}
      {driver?.cal ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {driver.cal.slope ? (
            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {driver.cal.slope.label}
              </label>
              <Input
                type="number"
                step="any"
                value={row.cal.slope ?? ""}
                onChange={(e) =>
                  onCalChange("slope", e.target.value === "" ? undefined : Number(e.target.value))
                }
              />
            </div>
          ) : null}
          {driver.cal.intercept ? (
            <div className="space-y-1">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {driver.cal.intercept.label}
              </label>
              <Input
                type="number"
                step="any"
                value={row.cal.intercept ?? ""}
                onChange={(e) =>
                  onCalChange("intercept", e.target.value === "" ? undefined : Number(e.target.value))
                }
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function countAnalogConflicts(sensors: SensorRow[], board: BoardDefinition): number {
  const analogPinNumbers = new Set(board.pins.filter((p) => p.analog).map((p) => p.gpio));
  const usage = new Map<number, number>();
  for (const s of sensors) {
    if (!s.enabled) continue;
    for (const gpio of Object.values(s.pins)) {
      if (analogPinNumbers.has(gpio)) {
        usage.set(gpio, (usage.get(gpio) ?? 0) + 1);
      }
    }
  }
  let conflicts = 0;
  for (const count of usage.values()) {
    if (count > 1) conflicts++;
  }
  return conflicts;
}

#!/usr/bin/env node
// Smoke test for apps/web/lib/firmware/patch-config.ts. Reads the placeholder
// .bin, splices a sample config in, and verifies that the same bytes round-trip
// through the marker pair. This is intentionally small and dependency-free so
// it can run in any Node 20 environment without bringing in jest/vitest.

import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildConfigJson,
  patchFirmwareBinary,
  CONFIG_BEGIN_MARKER,
  CONFIG_END_MARKER
} from "../../apps/web/lib/firmware/patch-config.ts";

const here = dirname(fileURLToPath(import.meta.url));
const binPath = resolve(
  here,
  "..",
  "..",
  "apps",
  "web",
  "public",
  "firmware",
  "wemos-d1-mini",
  "firmware.bin"
);

const json = buildConfigJson({
  wifi: { ssid: "TestNet", pass: "hunter2" },
  api: { baseUrl: "https://api.example.com/", deviceId: "device-123", apiKey: "ud_demo" },
  intervalSeconds: 60,
  sensors: [
    { key: "temperature", driver: "ds18b20", pins: { data: 4 } },
    {
      key: "ph",
      driver: "analog_ph",
      pins: { adc: 17 },
      cal: { slope: -5.7, intercept: 21.3 }
    }
  ]
});

const bin = new Uint8Array(await readFile(binPath));
const patched = patchFirmwareBinary(bin, json);

if (patched.length !== bin.length) {
  console.error(`FAIL: patched length ${patched.length} != original ${bin.length}`);
  process.exit(1);
}

const text = new TextDecoder().decode(patched);
const begin = text.indexOf(CONFIG_BEGIN_MARKER);
const end = text.indexOf(CONFIG_END_MARKER);
if (begin < 0 || end < 0 || end <= begin) {
  console.error("FAIL: markers missing in patched binary");
  process.exit(1);
}

const region = text.slice(begin + CONFIG_BEGIN_MARKER.length, end).trim();
let parsed;
try {
  parsed = JSON.parse(region);
} catch (err) {
  console.error("FAIL: JSON parse error", err);
  process.exit(1);
}

if (parsed.api.deviceId !== "device-123" || parsed.sensors.length !== 2) {
  console.error("FAIL: round-trip data mismatch", parsed);
  process.exit(1);
}

console.log(`OK: patched ${bin.length} bytes, JSON length ${region.length}, sensors ${parsed.sensors.length}`);

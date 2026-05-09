# ESP32 / ESP8266 → API ingestion guide

This document describes how a microcontroller should talk to the monitoring API’s **REST ingest** endpoint, and a practical plan for provisioning and firmware bring-up. Use it as the spec for an Arduino/PlatformIO sketch (another agent or developer can implement the client from this file alone).

The API does **not** use GraphQL for devices. Ingestion is **HTTP POST only** at `/ingest`.

---

## 1. Endpoint and transport

| Item | Detail |
|------|--------|
| **Method** | `POST` |
| **Path** | `/ingest` (no trailing slash required) |
| **Full URL** | `{API_BASE_URL}/ingest` — e.g. local `http://192.168.1.10:4000/ingest`, production `https://your-api.example.com/ingest` |
| **TLS** | Production should use **HTTPS**. Local dev often uses plain **HTTP**. |

**ESP8266 / ESP32 notes**

- Prefer **HTTPS** in production; you will need a TLS stack (`WiFiClientSecure` on Arduino) and a valid server certificate strategy (full CA store, or **certificate pinning** / SHA-256 fingerprint if you accept the maintenance cost).
- For **HTTP** (lab only), standard `WiFiClient` is enough.
- Ensure DNS resolution works on your LAN or use a **numeric IP** during early testing.

---

## 2. Required headers

| Header | Value |
|--------|--------|
| `Content-Type` | `application/json` |
| `x-api-key` | The device’s **plaintext** API key (the same string that was shown once when the device was created; the server stores **SHA-256(api key)**, not the raw key). |

- Send **exactly** the header name `x-api-key` (lowercase is conventional for HTTP/2; many servers treat header names as case-insensitive).
- Do **not** put the API key in the JSON body or in the URL query string.

---

## 3. Request body (JSON)

The body must be a single JSON object with three top-level fields.

### 3.1 Schema

```json
{
  "deviceId": "<string, non-empty>",
  "timestamp": "<ISO 8601 datetime string>",
  "readings": {
    "<sensorKey>": <number>,
    "...": <number>
  }
}
```

| Field | Rules |
|-------|--------|
| `deviceId` | Non-empty string. Must match the `device_id` column for a row in the `devices` table (e.g. seed uses `device-123`). This is **not** the database UUID; it is the human/device identifier configured when the device was registered. |
| `timestamp` | ISO 8601 datetime string accepted by the server validator (use **UTC** with `Z` suffix, e.g. `2026-05-07T18:30:00Z`). **Accurate time** matters for charts and offline detection; use **NTP** on the MCU. |
| `readings` | Object whose **keys** are strings and **values** are JSON numbers (finite: not `NaN`, not infinity). **At least one** key must be present. |

### 3.2 Sensor keys (`readings`)

- Each key in `readings` must exist in the **`sensor_catalog`** table (`key` column). Unknown keys cause **HTTP 400** and **no** measurements are stored for that request.
- Keys are **case-sensitive** (e.g. `temperature`, `ph`, `waterLevel`, `dissolvedOxygen` match typical seed data; your deployment may define more via the admin sensor catalog).
- **Partial uploads are allowed**: you may send only the sensors you have this cycle, as long as there is at least one reading.
- Values should be **raw numeric readings** in the unit implied by the catalog (e.g. °C, pH, %, mg/L) — the server stores the number as-is.

### 3.3 Behavior the firmware should understand

1. **Success (HTTP 200)**  
   Response body shape: `{ "ok": true, "inserted": <number> }`  
   `inserted` is the count of readings written (same as the number of keys in `readings` for a valid request).

2. **Invalid JSON or schema (HTTP 400)**  
   Examples: missing `readings`, empty `readings`, bad `timestamp` format, non-numeric values.  
   Body may include `{ "error": "Invalid payload", "issues": ... }` (Zod issues).

3. **Unknown sensor keys (HTTP 400)**  
   `{ "error": "Unknown sensor keys", "unknown": ["badKey", ...] }`  
   The **entire** request is rejected; fix keys to match `sensor_catalog` and retry.

4. **Missing or wrong API key / device mismatch (HTTP 401)**  
   - Missing or empty `x-api-key` → `"Missing x-api-key"`.  
   - Key present but no matching `devices` row for `(device_id, hash(api key))` → `"Invalid device credentials"`.  
   Ensure `deviceId` in JSON matches the provisioned device **and** the key matches that device.

5. **Site-disabled sensors**  
   If a sensor is **disabled** for the site in `site_sensor_catalog`, the server **still stores** the measurement for that reading key, but **does not** run anomaly detection for it. Firmware does not need a different payload; this is server policy.

6. **Anomaly detection**  
   Built-in anomaly rules exist only for a fixed set of “MVP” sensor keys in server code. Additional catalog sensors are stored and shown in the UI but may not get those rules until extended server-side. Firmware still sends numeric readings normally.

---

## 4. Example requests

### 4.1 curl (local)

```bash
curl -sS -X POST "http://localhost:4000/ingest" \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_PLAINTEXT_DEVICE_KEY" \
  -d '{
    "deviceId": "device-123",
    "timestamp": "2026-05-07T18:30:00.000Z",
    "readings": {
      "temperature": 24.3,
      "ph": 6.8
    }
  }'
```

### 4.2 Minimal valid body (one sensor)

```json
{
  "deviceId": "device-123",
  "timestamp": "2026-05-07T18:30:00Z",
  "readings": {
    "temperature": 22.1
  }
}
```

---

## 5. Provisioning plan (operators + firmware)

Use this checklist before flashing firmware.

### 5.1 Backend / database

The fastest path is the **admin device wizard** (`/admin/devices`):

1. Run migrations (`pnpm migrate` or your deploy pipeline).
2. Ensure a **site** exists, with the desired sensors enabled (admin **Add site** form).
3. Sign in as `admin`, open **Manage devices** → **Add device**, pick the site, set a friendly name, and choose the board. The wizard generates the `device_id` and the plaintext API key, shows the key **once**, and stores its SHA-256 hash in `devices.api_key_hash`.
4. Continue to **Install firmware**; the wizard auto-fills the API URL from `NEXT_PUBLIC_API_URL`, lets you confirm/rotate the API key, lets you map each enabled sensor to its driver and GPIO pin (with sensible defaults), then patches and flashes the firmware over USB via `esp-web-tools`.

If you cannot use the admin wizard (e.g. headless server provisioning), fall back to the legacy flow:

1. Use `pnpm seed` (development) or hand-roll an `INSERT INTO devices` with a SHA-256 hash of a random `ud_…` secret you generate yourself.
2. Record the plaintext API key once; the DB never stores it reversibly.
3. Bake `deviceId`, `apiKey`, and `apiBase` into the firmware's config JSON before building (see `firmware/aquaponics-node/src/config_block.cpp` for the in-binary placeholder format).
4. Confirm **`sensor_catalog`** contains every key you will send in `readings` (admin **Sensor catalog** UI). Add missing types before devices go to the field.
5. Optional: set `devices.expected_interval_seconds` (e.g. `300`) — used by the API scheduler for **device offline** alerts; align firmware upload interval with this.

### 5.2 Network

1. Wi-Fi SSID/password on the MCU.
2. **NTP** sync after Wi-Fi connect so `timestamp` is UTC and correct.
3. Resolve or hard-code the API host; test with `curl` from a PC on the same network.

### 5.3 Firmware (sketch) responsibilities

Suggested modules for the implementing agent:

1. **Wi-Fi connect** (and reconnect on loss).
2. **NTP** → build ISO 8601 UTC string for `timestamp`.
3. **Sensor read** → populate a `readings` map (only sensors that read successfully this cycle; still require ≥1 reading before POST, or skip POST if no data).
4. **HTTP POST** JSON to `{API_BASE}/ingest` with headers `Content-Type` and `x-api-key`.
5. **Response handling**: log HTTP code; on 400/401, avoid tight infinite retry loops (backoff); on 200, optionally blink LED / deep sleep until next interval.
6. **Secrets**: store API key in **flash / NVS / build-time secrets**, not in a public repo.
7. **Power**: if battery-powered, use deep sleep between posts; ensure wake interval ≤ offline threshold expectations.

### 5.4 Validation before field deploy

1. POST manually with `curl` using the same `deviceId`, key, and URL as the firmware.
2. Confirm rows appear in the dashboard for the site (measurements and last update).
3. Induce a wrong key and confirm **401**.
4. Send a bogus reading key and confirm **400** with `unknown` list.

---

## 6. Related repo references

| Area | Location |
|------|-----------|
| Ingest route | `apps/api/src/ingest/route.ts` |
| Payload validation (Zod) | `apps/api/src/ingest/validate.ts` |
| Human README section | `README.md` → “Device Ingestion” |
| Agent / ops context | `AGENTS.md` → ingestion + `sensor_catalog` |
| Reference firmware | `firmware/aquaponics-node/` (PlatformIO) |
| In-browser firmware patch helper | `apps/web/lib/firmware/patch-config.ts` |
| Admin install wizard | `apps/web/components/admin/device-install-wizard.tsx` |

---

## 7. Non-goals for device firmware

- Do **not** call GraphQL from the MCU for normal telemetry.
- Do **not** implement Auth.js / browser cookies; devices use **`x-api-key` only** on `/ingest`.

This is sufficient for another agent to produce an ESP32/ESP8266 sketch that posts compatible JSON on a timer.

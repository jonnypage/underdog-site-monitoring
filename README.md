# Aquaponics Monitoring MVP

MVP monitoring system for aquaponics deployments across roughly 30 sites. It ingests device sensor readings over REST, serves dashboard data over GraphQL, detects simple explainable anomalies, and sends email notifications for critical alerts.

## Stack

- Frontend: Next.js App Router, Tailwind CSS, shadcn-style dashboard components, Apollo Client, Nivo charts, Auth.js
- Backend: Node.js TypeScript, Fastify, GraphQL Yoga, REST `/ingest`
- Database: Railway PostgreSQL through Kysely migrations
- Notifications: Resend email

## Repo Layout

```text
apps/
  api/      Fastify + GraphQL Yoga + REST ingestion + alert scheduler
  web/      Next.js dashboard + Auth.js
packages/
  db/       Kysely types, client, migrations, seed script
```

For agent-facing handoff context, current repo status, and documentation maintenance expectations, see `AGENTS.md`.

## Setup

Requirements:

- Node.js 20.11+
- pnpm 9+
- PostgreSQL database, locally or through Railway PostgreSQL

Install dependencies:

```bash
pnpm install
```

Create local env files (same values in each; pnpm loads env from the package that is running):

```bash
cp .env.example packages/db/.env
cp .env.example apps/api/.env
cp .env.example apps/web/.env.local
```

Or copy from the committed templates: `packages/db/.env.example`, `apps/api/.env.example`, `apps/web/.env.example`.

Set at minimum:

- `DATABASE_URL`
- `AUTH_SECRET`
- `AUTH_URL` / `NEXTAUTH_URL`
- `NEXT_PUBLIC_API_URL`
- `WEB_ORIGIN`
- `RESEND_API_KEY` and `ALERT_FROM_EMAIL` for real email delivery

Run migrations:

```bash
pnpm migrate
```

Seed one admin, one site, and one device:

```bash
pnpm seed
```

The seed script prints the device API key once. Store it securely.

Start both apps:

```bash
pnpm dev
```

- Web: `http://localhost:3333`
- API: `http://localhost:4000`
- GraphQL endpoint: `http://localhost:4000/graphql`
- Health check: `http://localhost:4000/health`

If the dashboard shows **Failed to fetch** on GraphQL (e.g. Settings), the browser cannot reach the API: run both web and API, set `NEXT_PUBLIC_API_URL` in `apps/web/.env.local` to the API base URL (e.g. `http://localhost:4000`), and use the same `AUTH_SECRET` on web and API. In development, API CORS reflects your browser origin so `localhost` vs `127.0.0.1` is less strict; production still uses `WEB_ORIGIN` only.

## Device Firmware & Web Installer

The repo ships a PlatformIO firmware project at [`firmware/aquaponics-node`](firmware/aquaponics-node/README.md) targeting the Wemos D1 Mini (ESP8266); the source tree is structured so a future ESP32 build (e.g. the Cheap Yellow Display) shares the same drivers and config code.

Admins can flash devices straight from the browser:

1. Sign in as an `admin` and open **Admin → Manage devices** (`/admin/devices`).
2. **Add device** for a site; the API key is shown once — copy it immediately.
3. Click **Install** to open the wizard. Fill in Wi-Fi, confirm the API URL, pick which sensors are wired to which GPIO pins, click **Prepare firmware**, then **Connect & install**.

The installer downloads the precompiled firmware image from `apps/web/public/firmware/<board>/firmware.bin`, splices a JSON config (Wi-Fi, API key, sensor → pin map, interval) into a reserved 2 KiB region inside the binary, and hands it to [`esp-web-tools`](https://esphome.github.io/esp-web-tools/) to flash over WebSerial. Use Chrome or Edge on a desktop.

To build the firmware image locally, install [PlatformIO](https://docs.platformio.org/en/latest/core/installation/methods/index.html) and run:

```bash
cd firmware/aquaponics-node
pio run -e wemos_d1_mini
firmware/scripts/copy-binaries.sh wemos_d1_mini
```

> The `firmware.bin` currently committed under `apps/web/public/firmware/wemos-d1-mini/` is a *placeholder* (correct config-block layout but not flashable). Replace it with a real PlatformIO build before deploying.

## Device Ingestion

For **ESP32 / ESP8266** firmware authors: see [`docs/esp-device-ingest.md`](docs/esp-device-ingest.md) for the full HTTP contract, error handling, and provisioning checklist.

POST sensor data to `/ingest` with `x-api-key`:

```bash
curl -X POST http://localhost:4000/ingest \
  -H "content-type: application/json" \
  -H "x-api-key: <device-api-key>" \
  -d '{
    "deviceId": "device-123",
    "timestamp": "2026-05-01T15:00:00.000Z",
    "readings": {
      "temperature": 24.3,
      "ph": 6.8,
      "waterLevel": 72,
      "dissolvedOxygen": 6.1
    }
  }'
```

The API validates the payload (reading keys must exist in the `sensor_catalog` table), stores one measurement row per provided sensor, updates `devices.last_seen_at`, resolves any active `device_offline` alert for the site, and evaluates anomaly rules **only for sensors enabled** for that site in `site_sensor_catalog`. Critical/warning **range** checks use per-site `sensor_thresholds` when set, otherwise the catalog’s `physical_min` / `physical_max` defaults (admin site form).

## GraphQL

The dashboard uses GraphQL for reads, profile updates (`updateMe`), and **admin-only** user/site management. Device ingestion stays REST-only.

Queries:

- `getSites`
- `getSite(id)`
- `getMeasurements(siteId, range)`
- `getAlerts(siteId, type, status)`
- `getMe`
- `adminUsers`, `adminSites`, `adminDevices`, `adminDevice(id)` (requires `admin` role)

Mutations:

- `updateMe(input)` — change name, email, and/or password (current password required)
- `createAdminUser` / `updateAdminUser` / `resetAdminUserPassword` / `createAdminSite` / `updateAdminSite` (`admin` only); `resetAdminUserPassword` sets another user’s password without their current password (min 8 characters; **Admin → Users → Edit** → *Reset password*)
- `createAdminDevice` / `updateAdminDevice` / `rotateAdminDeviceApiKey` / `deleteAdminDevice` (`admin` only); `createAdminDevice` and `rotateAdminDeviceApiKey` return the plaintext API key once

`Site` includes optional GPS and per-sensor reporting flags; the site detail page can show a **Google Map** when `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY` is set (Maps Embed API). The admin **add/edit site** form uses the same key with the **Maps JavaScript API** for a draggable pin that syncs with latitude and longitude fields.

Regenerate GraphQL types:

```bash
pnpm codegen
```

## Dashboard UI

- **Login** (`/login`): email and password; the page shows the same organization logo as the dashboard (`apps/web/public/org/UILogo.webp` via `OrgLogo`).
- **Navigation**: On viewports `md` and wider, a fixed left sidebar lists **Sites**, **Alerts**, and **Admin** (admins only). On smaller screens the sidebar is hidden; open the **menu** control in the top bar to slide in the same links (plus logo). The header also shows a compact logo on mobile.
- **Account**: The top-right menu includes **Settings** (profile / password), theme, and **Log out**.

## Auth and RBAC

Auth.js uses email/password credentials with **JWT sessions** (required for the Credentials provider). Passwords and roles are read from Postgres; the session cookie is a signed JWT. The API verifies that cookie with **`AUTH_SECRET`**, which must be the **same value** as on the web service.

Roles:

- `admin`: full access to all sites
- `site_manager`: read/write access to all assigned sites
- `site_viewer`: read-only access to all assigned sites

Assignments live in `user_sites`, allowing both managers and viewers to be assigned to multiple sites. Backend resolvers enforce permissions; frontend UI only hides controls for convenience.

## Alerts and Notifications

Detected alert types:

- `low_oxygen`
- `ph_drift`
- `temperature_spike`
- `water_level_issue`
- `device_offline`

Only critical alerts trigger email. A cooldown (`COOLDOWN_MINUTES`, default 45) prevents notification spam while allowing repeated reminders for unresolved critical alerts.

## TimescaleDB Path

The MVP uses plain PostgreSQL only. The `measurements` table is intentionally Timescale-ready:

- composite primary key `(taken_at, id)`
- no inbound foreign keys to `measurements`
- indexes shaped for `(site_id, sensor, taken_at desc)` queries

A future migration can enable TimescaleDB and call `create_hypertable('measurements', 'taken_at', migrate_data => true)` without changing application-facing GraphQL.

## Railway Deployment

Deploy this repo as one Railway project with three services:

- `postgres`: Railway PostgreSQL
- `api`: Fastify + GraphQL Yoga backend
- `web`: Next.js frontend

Use the repository root as the root directory for both app services. The apps depend on the shared `packages/db` workspace package, so do not point Railway directly at `apps/api` or `apps/web` as isolated roots.

### Railway PostgreSQL

Create a Railway PostgreSQL service first. Railway exposes `DATABASE_URL`; reference that variable from both the API and web services.

Run migrations after the database is available:

```bash
pnpm migrate:deploy
```

You can run that as a Railway one-off command or from a temporary deploy command. Seed data is optional:

```bash
pnpm seed
```

### API Service

Railway service settings:

- Root directory: repository root
- Build command: `pnpm build:api`
- Start command: `pnpm start:api`

Environment variables:

- `DATABASE_URL` - reference the Railway PostgreSQL service
- `AUTH_SECRET` - **must match the web service**; used to validate the Auth.js JWT on GraphQL requests
- `WEB_ORIGIN` - deployed web URL, for CORS
- `AUTH_URL` - deployed web URL, used when validating Auth.js session behavior
- `RESEND_API_KEY`
- `ALERT_FROM_EMAIL`
- `COOLDOWN_MINUTES` - optional, defaults to `45`

Railway provides `PORT`; the API reads it automatically.

### Web Service

Railway service settings:

- Root directory: repository root
- Build command: `pnpm build:web`
- Start command: `pnpm start:web`

Environment variables:

- `DATABASE_URL` - reference the Railway PostgreSQL service; used for credential verification against `users`
- `AUTH_SECRET` - **same value as on the API service**
- `AUTH_URL` - deployed web URL
- `NEXTAUTH_URL` - deployed web URL
- `NEXT_PUBLIC_API_URL` - deployed API URL, for browser GraphQL requests

Railway provides `PORT`; `apps/web` starts Next.js with `next start -p ${PORT:-3333}` (local `pnpm start:web` without `PORT` matches dev port `3333`).

### Deployment Order

1. Create Railway PostgreSQL.
2. Deploy the API service with `DATABASE_URL`, `AUTH_SECRET` (match web later), and alert email env vars.
3. Run `pnpm migrate:deploy`.
4. Optionally run `pnpm seed` once to create a demo admin/site/device.
5. Deploy the web service.
6. Set `WEB_ORIGIN` on the API to the deployed web URL.
7. Set `NEXT_PUBLIC_API_URL` on the web service to the deployed API URL.

## Useful Scripts

```bash
pnpm dev        # run web and api
pnpm build      # build all packages/apps
pnpm build:api  # Railway API build command
pnpm build:web  # Railway web build command
pnpm start:api  # Railway API start command
pnpm start:web  # Railway web start command
pnpm typecheck  # typecheck all packages/apps
pnpm migrate    # run DB migrations
pnpm migrate:deploy # Railway migration command
pnpm seed       # create demo admin/site/device
pnpm codegen    # regenerate GraphQL types
```

import type { ColumnType, Generated, Insertable, Selectable, Updateable } from "kysely";

export type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>;
export type NullableTimestamp = ColumnType<Date | null, Date | string | null | undefined, Date | string | null>;

export type UserRole = "admin" | "site_manager" | "site_viewer";
export type AlertSeverity = "info" | "warning" | "critical";
export type AlertStatus = "active" | "resolved";
export type SensorType = "temperature" | "ph" | "waterLevel" | "dissolvedOxygen";

export interface UsersTable {
  id: Generated<string>;
  name: string | null;
  email: string;
  emailVerified: NullableTimestamp;
  image: string | null;
  password_hash: string | null;
  role: UserRole;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface AccountsTable {
  id: Generated<string>;
  userId: string;
  type: string;
  provider: string;
  providerAccountId: string;
  refresh_token: string | null;
  access_token: string | null;
  expires_at: number | null;
  token_type: string | null;
  scope: string | null;
  id_token: string | null;
  session_state: string | null;
}

export interface SessionsTable {
  id: Generated<string>;
  sessionToken: string;
  userId: string;
  expires: Timestamp;
}

export interface VerificationTokensTable {
  identifier: string;
  token: string;
  expires: Timestamp;
}

export interface SensorCatalogTable {
  id: Generated<string>;
  key: string;
  display_name: string;
  unit: string;
  physical_min: number | null;
  physical_max: number | null;
  sort_order: number;
  icon: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface SiteSensorCatalogTable {
  site_id: string;
  sensor_catalog_id: string;
  enabled: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface SitesTable {
  id: Generated<string>;
  name: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface DevicePinMap {
  [sensorKey: string]: {
    driver: string;
    pins: Record<string, number>;
    cal?: { slope?: number; intercept?: number };
  };
}

export interface DevicesTable {
  id: Generated<string>;
  site_id: string | null;
  device_id: string;
  api_key_hash: string;
  expected_interval_seconds: number;
  last_seen_at: NullableTimestamp;
  name: string | null;
  board: string | null;
  pin_map: ColumnType<DevicePinMap | null, DevicePinMap | null | undefined, DevicePinMap | null>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface UserSitesTable {
  user_id: string;
  site_id: string;
  created_at: Timestamp;
}

export interface SensorThresholdsTable {
  id: Generated<string>;
  site_id: string;
  /** Matches `sensor_catalog.key`. */
  sensor: string;
  /** Null = use catalog `physical_min` for this site/sensor. */
  min_value: number | null;
  /** Null = use catalog `physical_max` for this site/sensor. */
  max_value: number | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface MeasurementsTable {
  id: Generated<string>;
  site_id: string;
  device_id: string | null;
  /** Matches `sensor_catalog.key` for ingested readings. */
  sensor: string;
  value: number;
  taken_at: Timestamp;
  ingested_at: Timestamp;
}

export interface AlertsTable {
  id: Generated<string>;
  site_id: string;
  device_id: string | null;
  type: string;
  message: string;
  severity: AlertSeverity;
  status: AlertStatus;
  created_at: Timestamp;
  resolved_at: NullableTimestamp;
  last_notified_at: NullableTimestamp;
}

export interface Database {
  users: UsersTable;
  accounts: AccountsTable;
  sessions: SessionsTable;
  verification_tokens: VerificationTokensTable;
  sites: SitesTable;
  sensor_catalog: SensorCatalogTable;
  site_sensor_catalog: SiteSensorCatalogTable;
  devices: DevicesTable;
  user_sites: UserSitesTable;
  sensor_thresholds: SensorThresholdsTable;
  measurements: MeasurementsTable;
  alerts: AlertsTable;
}

export type User = Selectable<UsersTable>;
export type NewUser = Insertable<UsersTable>;
export type Site = Selectable<SitesTable>;
export type NewSite = Insertable<SitesTable>;
export type Device = Selectable<DevicesTable>;
export type NewDevice = Insertable<DevicesTable>;
export type Measurement = Selectable<MeasurementsTable>;
export type NewMeasurement = Insertable<MeasurementsTable>;
export type Alert = Selectable<AlertsTable>;
export type NewAlert = Insertable<AlertsTable>;
export type AlertUpdate = Updateable<AlertsTable>;

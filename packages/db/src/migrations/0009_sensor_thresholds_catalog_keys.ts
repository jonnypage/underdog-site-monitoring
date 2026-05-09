import { sql, type Kysely } from "kysely";

/** Allow any `sensor_catalog.key` in `sensor_thresholds.sensor` (drop legacy four-literal check). */
export async function up(db: Kysely<unknown>) {
  await sql`
    alter table sensor_thresholds
    drop constraint if exists sensor_thresholds_sensor_check
  `.execute(db);
}

export async function down(db: Kysely<unknown>) {
  await sql`
    alter table sensor_thresholds
    add constraint sensor_thresholds_sensor_check
    check (sensor in ('temperature', 'ph', 'waterLevel', 'dissolvedOxygen'))
  `.execute(db);
}

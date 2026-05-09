import { sql, type Kysely } from "kysely";

/** Allow any catalog-backed sensor key in measurements (not only the original four literals). */
export async function up(db: Kysely<unknown>) {
  await sql`
    alter table measurements
    drop constraint if exists measurements_sensor_check
  `.execute(db);
}

export async function down(db: Kysely<unknown>) {
  await sql`
    alter table measurements
    add constraint measurements_sensor_check
    check (sensor in ('temperature', 'ph', 'waterLevel', 'dissolvedOxygen'))
  `.execute(db);
}

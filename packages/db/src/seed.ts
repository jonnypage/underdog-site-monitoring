import "dotenv/config";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { createDb } from "./client.js";

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function main() {
  const db = createDb();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";
  const deviceApiKey = `ud_${randomBytes(24).toString("base64url")}`;

  const admin = await db
    .insertInto("users")
    .values({
      email: process.env.SEED_ADMIN_EMAIL ?? "admin@example.com",
      name: "Admin",
      password_hash: await bcrypt.hash(adminPassword, 12),
      role: "admin"
    })
    .onConflict((oc) => oc.column("email").doUpdateSet({ role: "admin" }))
    .returning(["id", "email"])
    .executeTakeFirstOrThrow();

  const site = await db
    .insertInto("sites")
    .values({ name: "Demo Aquaponics Site", location: "Demo greenhouse" })
    .returning(["id", "name"])
    .executeTakeFirstOrThrow();

  const catalog = await db.selectFrom("sensor_catalog").select("id").execute();
  if (catalog.length > 0) {
    const now = new Date();
    await db
      .insertInto("site_sensor_catalog")
      .values(
        catalog.map((c) => ({
          site_id: site.id,
          sensor_catalog_id: c.id,
          enabled: true,
          created_at: now,
          updated_at: now
        }))
      )
      .execute();
  }

  await db
    .insertInto("devices")
    .values({
      site_id: site.id,
      device_id: "device-123",
      api_key_hash: sha256(deviceApiKey),
      expected_interval_seconds: 300,
      name: "Demo node",
      board: "wemos_d1_mini",
      pin_map: null
    })
    .execute();

  console.log(`Admin: ${admin.email}`);
  console.log(`Admin password: ${adminPassword}`);
  console.log(`Site: ${site.name}`);
  console.log(`Device ID: device-123`);
  console.log(`Device API key (shown once): ${deviceApiKey}`);

  await db.destroy();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

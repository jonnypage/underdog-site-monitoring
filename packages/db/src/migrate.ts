import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import "dotenv/config";
import { Migrator, type Migration, type MigrationProvider } from "kysely";
import { createDb } from "./client.js";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationFolder = path.join(dirname, "migrations");

class EsmMigrationProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<string, Migration>> {
    const files = (await fs.readdir(migrationFolder)).filter((file) => file.endsWith(".ts") || file.endsWith(".js")).sort();
    const migrations: Record<string, Migration> = {};

    for (const file of files) {
      const name = file.replace(/\.(ts|js)$/, "");
      migrations[name] = await import(pathToFileURL(path.join(migrationFolder, file)).href);
    }

    return migrations;
  }
}

async function main() {
  const db = createDb();
  const migrator = new Migrator({
    db,
    provider: new EsmMigrationProvider()
  });

  const command = process.argv[2] ?? "latest";
  const result = command === "down" ? await migrator.migrateDown() : await migrator.migrateToLatest();

  for (const item of result.results ?? []) {
    if (item.status === "Success") {
      console.log(`${item.migrationName}: migrated`);
    } else if (item.status === "Error") {
      console.error(`${item.migrationName}: failed`);
    }
  }

  if (result.error) {
    console.error(result.error);
    process.exitCode = 1;
  }

  await db.destroy();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

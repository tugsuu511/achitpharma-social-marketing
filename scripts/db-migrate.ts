import { existsSync } from "node:fs";
import { migratePostgres } from "../src/lib/postgres-migrations";

for (const filename of [".env.production.local", ".env.local", ".env.production", ".env"]) {
  if (existsSync(filename)) process.loadEnvFile(filename);
}

async function main() {
  const result = await migratePostgres();
  console.log(`Database schema is current: ${result.status.current}/${result.status.latest}.`);
  if (result.applied.length) console.log(`Applied migrations: ${result.applied.join(", ")}.`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : "Database migration failed.");
  process.exitCode = 1;
});

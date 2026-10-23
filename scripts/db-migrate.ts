import { existsSync } from "node:fs";
import { db } from "../src/lib/db";
import { migrationStatus } from "../src/lib/migrations";

for (const filename of [".env.production.local", ".env.local", ".env.production", ".env"]) {
  if (existsSync(filename)) process.loadEnvFile(filename);
}

try {
  const status = migrationStatus(db());
  console.log(`Database schema is current: ${status.current}/${status.latest}.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Database migration failed.");
  process.exitCode = 1;
}

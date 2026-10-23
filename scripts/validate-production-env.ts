import { existsSync } from "node:fs";
import { validateProductionEnvironment } from "../src/lib/config";

for (const filename of [".env.production.local", ".env.local", ".env.production", ".env"]) {
  if (existsSync(filename)) process.loadEnvFile(filename);
}

try {
  validateProductionEnvironment();
  console.log("Production environment validated.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Production environment is invalid.");
  process.exitCode = 1;
}

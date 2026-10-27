import { existsSync } from "node:fs";
import { db, transaction } from "../src/lib/db";

for (const filename of [".env.production.local",".env.local",".env.production",".env"]) if (existsSync(filename)) process.loadEnvFile(filename);

const now = Date.now();
const auditBefore = new Date(now - 365 * 24 * 60 * 60 * 1000).toISOString();
async function main() {
  const result = await transaction(async () => ({
    sessions: (await db().prepare("DELETE FROM sessions WHERE expires <= ? OR lastSeenAt <= ?").run(now,now-24*60*60*1000)).changes,
    loginAttempts: (await db().prepare("DELETE FROM login_attempts WHERE resetAt <= ?").run(now)).changes,
    auditEvents: (await db().prepare("DELETE FROM audit_events WHERE createdAt < ?").run(auditBefore)).changes,
  }));
  console.log(JSON.stringify({ status: "ok", cleanedAt: new Date(now).toISOString(), deleted: result },null,2));
}

main().catch(error => { console.error(error instanceof Error ? error.message : "Cleanup failed."); process.exitCode = 1; });

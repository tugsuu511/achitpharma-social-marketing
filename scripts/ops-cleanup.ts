import { existsSync } from "node:fs";
import { db, transaction } from "../src/lib/db";

for (const filename of [".env.production.local",".env.local",".env.production",".env"]) if (existsSync(filename)) process.loadEnvFile(filename);

const now = Date.now();
const auditBefore = new Date(now - 365 * 24 * 60 * 60 * 1000).toISOString();
const result = transaction(() => ({
  sessions: db().prepare("DELETE FROM sessions WHERE expires <= ? OR lastSeenAt <= ?").run(now,now-24*60*60*1000).changes,
  loginAttempts: db().prepare("DELETE FROM login_attempts WHERE resetAt <= ?").run(now).changes,
  auditEvents: db().prepare("DELETE FROM audit_events WHERE createdAt < ?").run(auditBefore).changes,
}));
console.log(JSON.stringify({ status: "ok", cleanedAt: new Date(now).toISOString(), deleted: result },null,2));

import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { closeDatabase, db, pool } from "../src/lib/db";
import { migrationStatus } from "../src/lib/postgres-migrations";
import { privateFilesDirectory, readAttachment } from "../src/lib/storage";

for (const filename of [".env.production.local", ".env.local", ".env.production", ".env"]) {
  if (existsSync(filename)) process.loadEnvFile(filename);
}

function directoryStats(root: string) {
  let files = 0; let bytes = 0;
  if (!existsSync(root)) return { files, bytes };
  const visit = (directory: string) => { for (const entry of readdirSync(directory,{ withFileTypes: true })) { const filename = path.join(directory,entry.name); if (entry.isDirectory()) visit(filename); else if (entry.isFile()) { files++; bytes += statSync(filename).size; } } };
  visit(root); return { files, bytes };
}

async function main() {
  const connection = pool();
  await connection.query("SELECT 1");
  const schema = await migrationStatus(connection);
  const tables = ["users","tasks","sessions","attachments","audit_events"];
  const counts = Object.fromEntries(await Promise.all(tables.map(async table => [table,(await db().prepare(`SELECT COUNT(*) AS count FROM ${table}`).get<{ count: number }>())?.count ?? 0])));
  const dataDirectory = path.resolve(process.env.DATA_DIR || path.join(process.cwd(),"data"));
  const privatePath = privateFilesDirectory(dataDirectory);
  const privateFiles = { path: privatePath, ...directoryStats(privatePath) };
  const attachments = await db().prepare("SELECT storageKey,checksum FROM attachments").all<{ storageKey: string; checksum: string }>();
  let invalidFiles = 0;
  for (const attachment of attachments) {
    try { readAttachment(attachment.storageKey,attachment.checksum,dataDirectory); }
    catch { invalidFiles++; }
  }
  const issues: string[] = [];
  if (schema.current !== schema.latest) issues.push("schema_outdated");
  if (privateFiles.files !== counts.attachments) issues.push("attachment_file_count_mismatch");
  if (invalidFiles) issues.push("attachment_checksum_or_file_missing");
  const report = {
    status: issues.length ? "degraded" : "ok",
    issues,
    checkedAt: new Date().toISOString(),
    database: { provider: "neon-postgres", branch: process.env.NEON_BRANCH || "unknown", reachable: true, schema: { current: schema.current, latest: schema.latest }, counts },
    privateFiles: { ...privateFiles, invalid: invalidFiles },
  };
  console.log(JSON.stringify(report,null,2));
  if (report.status !== "ok") process.exitCode = 1;
}

main().catch(error => { console.error(error instanceof Error ? error.message : "Operational status check failed."); process.exitCode = 1; }).finally(closeDatabase);

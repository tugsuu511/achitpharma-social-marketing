import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { migrationStatus } from "../src/lib/migrations";
import { privateFilesDirectory } from "../src/lib/storage";

for (const filename of [".env.production.local",".env.local",".env.production",".env"]) if (existsSync(filename)) process.loadEnvFile(filename);

function directoryStats(root: string) {
  let files = 0; let bytes = 0;
  if (!existsSync(root)) return { files, bytes };
  const visit = (directory: string) => { for (const entry of readdirSync(directory,{ withFileTypes: true })) { const filename = path.join(directory,entry.name); if (entry.isDirectory()) visit(filename); else if (entry.isFile()) { files++; bytes += statSync(filename).size; } } };
  visit(root); return { files, bytes };
}

const dataDirectory = path.resolve(process.env.DATA_DIR || path.join(process.cwd(),"data"));
const databasePath = path.join(dataDirectory,"workspace.sqlite");
if (!existsSync(databasePath)) throw new Error(`Database not found: ${databasePath}`);
const connection = new DatabaseSync(databasePath,{ readOnly: true });
try {
  const quickCheck = Object.values(connection.prepare("PRAGMA quick_check").get() as Record<string,unknown>)[0];
  const migrations = migrationStatus(connection);
  const counts = Object.fromEntries(["users","tasks","sessions","attachments","audit_events"].map(table => [table,(connection.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count]));
  const backupDirectory = path.resolve(process.env.BACKUP_DIR || path.join(process.cwd(),"backups"));
  const manifests = existsSync(backupDirectory) ? readdirSync(backupDirectory).filter(name => name.endsWith(".sqlite.json")).map(name => ({ name, modifiedAt: statSync(path.join(backupDirectory,name)).mtime.toISOString() })).sort((a,b) => b.modifiedAt.localeCompare(a.modifiedAt)) : [];
  const databaseBytes = statSync(databasePath).size;
  const walPath = `${databasePath}-wal`;
  const privateFiles = { path: privateFilesDirectory(dataDirectory), ...directoryStats(privateFilesDirectory(dataDirectory)) };
  const issues: string[] = [];
  if (quickCheck !== "ok") issues.push("database_integrity");
  if (migrations.current !== migrations.latest) issues.push("schema_outdated");
  if (privateFiles.files !== counts.attachments) issues.push("attachment_file_count_mismatch");
  if (!manifests[0]) issues.push("backup_missing");
  else if (Date.now()-Date.parse(manifests[0].modifiedAt) > 36*60*60*1000) issues.push("backup_older_than_36h");
  const report = { status: issues.length ? "degraded" : "ok", issues, checkedAt: new Date().toISOString(), database: { path: databasePath, bytes: databaseBytes, walBytes: existsSync(walPath) ? statSync(walPath).size : 0, integrity: quickCheck, schema: { current: migrations.current, latest: migrations.latest }, counts }, privateFiles, backups: { path: backupDirectory, latest: manifests[0] || null, count: manifests.length } };
  console.log(JSON.stringify(report,null,2));
  if (report.status !== "ok") process.exitCode = 1;
} finally { connection.close(); }

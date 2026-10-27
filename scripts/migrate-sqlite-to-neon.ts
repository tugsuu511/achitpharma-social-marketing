import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { closeDatabase, db, transaction } from "../src/lib/db";
import { migratePostgres } from "../src/lib/postgres-migrations";

for (const filename of [".env.production.local", ".env.local", ".env.production", ".env"]) {
  if (existsSync(filename)) process.loadEnvFile(filename);
}

const TABLES = [
  { name: "users", columns: ["id","name","email","password","role","title","active","createdAt"] },
  { name: "sessions", columns: ["token","userId","expires","createdAt","lastSeenAt"] },
  { name: "login_attempts", columns: ["key","attempts","resetAt"] },
  { name: "tasks", columns: ["id","title","description","assigneeId","platform","priority","dueDate","status","createdBy","createdAt","updatedAt","approvedAt"] },
  { name: "submissions", columns: ["id","taskId","userId","note","createdAt"] },
  { name: "attachments", columns: ["id","taskId","submissionId","name","mime","size","storageKey","checksum","createdAt"] },
  { name: "activities", columns: ["id","taskId","userId","kind","message","createdAt"] },
  { name: "audit_events", columns: ["id","requestId","actorId","event","targetType","targetId","outcome","ipHash","metadata","createdAt"] },
] as const;

type Row = Record<string, string | number | null>;

async function main() {
  const sourcePath = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), "data"), "workspace.sqlite");
  if (!existsSync(sourcePath)) throw new Error(`Legacy SQLite database not found: ${sourcePath}`);

  await migratePostgres();
  const source = new DatabaseSync(sourcePath, { readOnly: true });
  try {
    const integrity = Object.values(source.prepare("PRAGMA quick_check").get() as Record<string, unknown>)[0];
    if (integrity !== "ok") throw new Error("Legacy SQLite integrity check failed.");
    const rowsByTable = Object.fromEntries(TABLES.map(table => [table.name, source.prepare(`SELECT ${table.columns.join(",")} FROM ${table.name} ORDER BY 1`).all() as unknown as Row[]])) as Record<string, Row[]>;
    const sourceChecksum = createHash("sha256").update(JSON.stringify(rowsByTable)).digest("hex");
    const importId = "legacy-sqlite-v1";
    const previous = await db().prepare("SELECT checksum FROM data_imports WHERE id=?").get<{ checksum: string }>(importId);
    if (previous) {
      if (previous.checksum !== sourceChecksum) throw new Error("Neon already contains a different legacy SQLite import.");
      console.log("Legacy SQLite data was already imported; no changes made.");
      return;
    }

    const targetCounts = await Promise.all(TABLES.map(async table => ({ name: table.name, count: (await db().prepare(`SELECT COUNT(*) AS count FROM ${table.name}`).get<{ count: number }>())?.count ?? 0 })));
    const occupied = targetCounts.filter(item => item.count > 0);
    if (occupied.length) throw new Error(`Neon target is not empty: ${occupied.map(item => item.name).join(", ")}.`);

    await transaction(async () => {
      for (const table of TABLES) {
        const placeholders = table.columns.map(() => "?").join(",");
        const insert = db().prepare(`INSERT INTO ${table.name}(${table.columns.join(",")}) VALUES(${placeholders})`);
        for (const row of rowsByTable[table.name]) await insert.run(...table.columns.map(column => row[column]));
      }
      await db().prepare("INSERT INTO data_imports(id,checksum,createdAt) VALUES(?,?,?)").run(importId,sourceChecksum,new Date().toISOString());
    });

    const verified = await Promise.all(TABLES.map(async table => ({ name: table.name, source: rowsByTable[table.name].length, target: (await db().prepare(`SELECT COUNT(*) AS count FROM ${table.name}`).get<{ count: number }>())?.count ?? 0 })));
    const mismatch = verified.find(item => item.source !== item.target);
    if (mismatch) throw new Error(`Import count mismatch for ${mismatch.name}: ${mismatch.source}/${mismatch.target}.`);
    console.log(JSON.stringify({ status: "ok", imported: Object.fromEntries(verified.map(item => [item.name,item.target])) }, null, 2));
  } finally {
    source.close();
    await closeDatabase();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : "SQLite to Neon migration failed.");
  process.exitCode = 1;
});

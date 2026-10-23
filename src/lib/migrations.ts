import { createHash, randomBytes } from "node:crypto";
import { closeSync, existsSync, mkdirSync, openSync, readSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { DatabaseSync as SQLiteDatabase } from "node:sqlite";
import { storeAttachment } from "./storage";

type Migration = { version: number; name: string; sql: string; fingerprint?: string; prepare?: (connection: DatabaseSync, options: MigrationOptions) => void };
type AppliedMigration = { version: number; name: string; checksum: string; appliedAt: string };
type MigrationOptions = { databasePath: string; dataDirectory: string; backupDirectory?: string };
export type MigrationResult = { applied: number[]; backupPath: string | null };

const migrations: Migration[] = [
  {
    version: 1,
    name: "initial_schema",
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, checksum TEXT NOT NULL, appliedAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','employee')),
        title TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1, createdAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY, userId TEXT NOT NULL REFERENCES users(id), expires INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS login_attempts (
        key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, resetAt INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
        assigneeId TEXT NOT NULL REFERENCES users(id), platform TEXT NOT NULL,
        priority TEXT NOT NULL CHECK(priority IN ('normal','high')), dueDate TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('planned','in_progress','submitted','revision','approved')),
        createdBy TEXT NOT NULL REFERENCES users(id), createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, approvedAt TEXT
      );
      CREATE INDEX IF NOT EXISTS tasks_assignee ON tasks(assigneeId);
      CREATE TABLE IF NOT EXISTS submissions (
        id TEXT PRIMARY KEY, taskId TEXT NOT NULL REFERENCES tasks(id), userId TEXT NOT NULL REFERENCES users(id),
        note TEXT NOT NULL, createdAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY, taskId TEXT NOT NULL REFERENCES tasks(id), submissionId TEXT NOT NULL REFERENCES submissions(id),
        name TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, data BLOB NOT NULL, createdAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS attachments_task ON attachments(taskId);
      CREATE TABLE IF NOT EXISTS activities (
        id TEXT PRIMARY KEY, taskId TEXT NOT NULL REFERENCES tasks(id), userId TEXT NOT NULL REFERENCES users(id),
        kind TEXT NOT NULL, message TEXT NOT NULL, createdAt TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS activities_task ON activities(taskId);
    `,
  },
  {
    version: 2,
    name: "operational_indexes",
    sql: `
      CREATE INDEX IF NOT EXISTS sessions_expires ON sessions(expires);
      CREATE INDEX IF NOT EXISTS sessions_user ON sessions(userId);
      CREATE INDEX IF NOT EXISTS login_attempts_reset ON login_attempts(resetAt);
      CREATE INDEX IF NOT EXISTS tasks_status_due ON tasks(status,dueDate);
      CREATE INDEX IF NOT EXISTS tasks_assignee_due ON tasks(assigneeId,dueDate);
      CREATE INDEX IF NOT EXISTS submissions_task ON submissions(taskId);
      CREATE INDEX IF NOT EXISTS attachments_submission ON attachments(submissionId);
    `,
  },
  {
    version: 3,
    name: "audit_and_session_metadata",
    sql: `
      ALTER TABLE sessions ADD COLUMN createdAt INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE sessions ADD COLUMN lastSeenAt INTEGER NOT NULL DEFAULT 0;
      CREATE TABLE audit_events (
        id TEXT PRIMARY KEY, requestId TEXT NOT NULL, actorId TEXT REFERENCES users(id), event TEXT NOT NULL,
        targetType TEXT NOT NULL DEFAULT '', targetId TEXT NOT NULL DEFAULT '', outcome TEXT NOT NULL,
        ipHash TEXT NOT NULL DEFAULT '', metadata TEXT NOT NULL DEFAULT '{}', createdAt TEXT NOT NULL
      );
      CREATE INDEX audit_events_created ON audit_events(createdAt);
      CREATE INDEX audit_events_actor ON audit_events(actorId,createdAt);
    `,
  },
  {
    version: 4,
    name: "attachment_storage_columns",
    sql: `
      ALTER TABLE attachments ADD COLUMN storageKey TEXT;
      ALTER TABLE attachments ADD COLUMN checksum TEXT;
    `,
  },
  {
    version: 5,
    name: "private_attachment_storage",
    fingerprint: "export-attachment-blobs-v1",
    prepare(connection, options) {
      const rows = connection.prepare("SELECT id,data FROM attachments WHERE storageKey IS NULL OR checksum IS NULL").all() as unknown as { id: string; data: Uint8Array }[];
      const update = connection.prepare("UPDATE attachments SET storageKey=?,checksum=? WHERE id=?");
      for (const row of rows) {
        const stored = storeAttachment(row.id, row.data, options.dataDirectory);
        update.run(stored.key, stored.checksum, row.id);
      }
    },
    sql: `
      CREATE TABLE attachments_next (
        id TEXT PRIMARY KEY, taskId TEXT NOT NULL REFERENCES tasks(id), submissionId TEXT NOT NULL REFERENCES submissions(id),
        name TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, storageKey TEXT NOT NULL UNIQUE,
        checksum TEXT NOT NULL, createdAt TEXT NOT NULL
      );
      INSERT INTO attachments_next(id,taskId,submissionId,name,mime,size,storageKey,checksum,createdAt)
        SELECT id,taskId,submissionId,name,mime,size,storageKey,checksum,createdAt FROM attachments;
      DROP TABLE attachments;
      ALTER TABLE attachments_next RENAME TO attachments;
      CREATE INDEX attachments_task ON attachments(taskId);
      CREATE INDEX attachments_submission ON attachments(submissionId);
    `,
  },
];

const checksum = (value: string) => createHash("sha256").update(value).digest("hex");

function migrationChecksum(migration: Migration) {
  const source = `${migration.version}:${migration.name}:${migration.sql}`;
  return checksum(migration.fingerprint ? `${source}:${migration.fingerprint}` : source);
}

function hasTable(connection: DatabaseSync, name: string) {
  return !!connection.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name=?").get(name);
}

function appliedMigrations(connection: DatabaseSync): AppliedMigration[] {
  if (!hasTable(connection, "schema_migrations")) return [];
  return connection.prepare("SELECT version,name,checksum,appliedAt FROM schema_migrations ORDER BY version").all() as unknown as AppliedMigration[];
}

function verifyApplied(applied: AppliedMigration[]) {
  for (const record of applied) {
    const migration = migrations.find(item => item.version === record.version);
    if (!migration) throw new Error(`Database migration ${record.version} is newer than this application.`);
    if (record.name !== migration.name || record.checksum !== migrationChecksum(migration)) {
      throw new Error(`Database migration ${record.version} does not match the application migration history.`);
    }
  }
}

function isInside(parent: string, child: string) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function sha256File(filename: string) {
  const hash = createHash("sha256");
  const descriptor = openSync(filename, "r");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    while (true) {
      const bytes = readSync(descriptor, buffer, 0, buffer.length, null);
      if (!bytes) break;
      hash.update(buffer.subarray(0, bytes));
    }
  } finally {
    closeSync(descriptor);
  }
  return hash.digest("hex");
}

function verifyDatabase(filename: string) {
  const connection = new SQLiteDatabase(filename, { readOnly: true });
  try {
    const result = connection.prepare("PRAGMA quick_check").get() as Record<string, unknown>;
    if (Object.values(result)[0] !== "ok") throw new Error("Pre-migration backup integrity check failed.");
  } finally {
    connection.close();
  }
}

function createMigrationBackup(connection: DatabaseSync, options: MigrationOptions, pending: number[]) {
  const backupDirectory = path.resolve(/*turbopackIgnore: true*/ options.backupDirectory || process.env.BACKUP_DIR || path.join(process.cwd(), "backups"));
  if (isInside(path.resolve(options.dataDirectory), backupDirectory)) throw new Error("BACKUP_DIR must be outside DATA_DIR before migration.");
  mkdirSync(backupDirectory, { recursive: true });
  const createdAt = new Date().toISOString();
  const stamp = createdAt.replaceAll(":", "-").replaceAll(".", "-");
  const filename = `pre-migration-${stamp}-${randomBytes(4).toString("hex")}.sqlite`;
  const destination = path.join(backupDirectory, filename);
  connection.prepare("VACUUM INTO ?").run(destination);
  verifyDatabase(destination);
  const fileChecksum = sha256File(destination);
  writeFileSync(`${destination}.json`, JSON.stringify({ version: 1, kind: "pre-migration", createdAt, filename, databaseFile: path.basename(options.databasePath), bytes: statSync(destination).size, pendingMigrations: pending, sha256: fileChecksum }, null, 2) + "\n", { encoding: "utf8", flag: "wx" });
  return destination;
}

function hasApplicationData(connection: DatabaseSync) {
  return !!connection.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name <> 'schema_migrations' LIMIT 1").get();
}

export function migrate(connection: DatabaseSync, options: MigrationOptions): MigrationResult {
  const initialApplied = appliedMigrations(connection);
  verifyApplied(initialApplied);
  const appliedVersions = new Set(initialApplied.map(item => item.version));
  const pending = migrations.filter(item => !appliedVersions.has(item.version));
  if (!pending.length) return { applied: [], backupPath: null };

  const backupPath = hasApplicationData(connection) ? createMigrationBackup(connection, options, pending.map(item => item.version)) : null;
  const applied: number[] = [];
  for (const migration of pending) {
    migration.prepare?.(connection, options);
    connection.exec("BEGIN IMMEDIATE");
    try {
      const existing = hasTable(connection, "schema_migrations")
        ? connection.prepare("SELECT name,checksum FROM schema_migrations WHERE version=?").get(migration.version) as { name: string; checksum: string } | undefined
        : undefined;
      if (existing) {
        if (existing.name !== migration.name || existing.checksum !== migrationChecksum(migration)) throw new Error(`Database migration ${migration.version} conflicts with this application.`);
      } else {
        connection.exec(migration.sql);
        connection.prepare("INSERT INTO schema_migrations(version,name,checksum,appliedAt) VALUES(?,?,?,?)")
          .run(migration.version, migration.name, migrationChecksum(migration), new Date().toISOString());
        connection.exec(`PRAGMA user_version = ${migration.version}`);
        applied.push(migration.version);
      }
      connection.exec("COMMIT");
    } catch (error) {
      connection.exec("ROLLBACK");
      throw error;
    }
  }

  const integrity = connection.prepare("PRAGMA quick_check").get() as Record<string, unknown>;
  if (Object.values(integrity)[0] !== "ok") throw new Error("Database integrity check failed after migration.");
  const foreignKeyProblem = connection.prepare("PRAGMA foreign_key_check").get();
  if (foreignKeyProblem) throw new Error("Foreign key validation failed after migration.");
  return { applied, backupPath };
}

export function migrationStatus(connection: DatabaseSync) {
  const applied = appliedMigrations(connection);
  verifyApplied(applied);
  return { current: applied.at(-1)?.version ?? 0, latest: migrations.at(-1)?.version ?? 0, applied };
}

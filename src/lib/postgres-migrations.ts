import { createHash } from "node:crypto";
import { Client, type QueryResult, type QueryResultRow } from "pg";
import { migrationDatabaseUrl } from "./postgres-url";

type Migration = { version: number; name: string; sql: string };
type AppliedMigration = { version: number; name: string; checksum: string; appliedAt: string };

const migrations: Migration[] = [
  {
    version: 1,
    name: "postgres_initial_schema",
    sql: `
      CREATE TABLE users (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL,
        password TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','employee')),
        title TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), "createdAt" TEXT NOT NULL
      );
      CREATE UNIQUE INDEX users_email_unique ON users (lower(email));
      CREATE TABLE sessions (
        token TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES users(id), expires BIGINT NOT NULL,
        "createdAt" BIGINT NOT NULL DEFAULT 0, "lastSeenAt" BIGINT NOT NULL DEFAULT 0
      );
      CREATE TABLE login_attempts (
        key TEXT PRIMARY KEY, attempts INTEGER NOT NULL, "resetAt" BIGINT NOT NULL
      );
      CREATE TABLE tasks (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
        "assigneeId" TEXT NOT NULL REFERENCES users(id), platform TEXT NOT NULL,
        priority TEXT NOT NULL CHECK(priority IN ('normal','high')), "dueDate" TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('planned','in_progress','submitted','revision','approved')),
        "createdBy" TEXT NOT NULL REFERENCES users(id), "createdAt" TEXT NOT NULL, "updatedAt" TEXT NOT NULL, "approvedAt" TEXT
      );
      CREATE TABLE submissions (
        id TEXT PRIMARY KEY, "taskId" TEXT NOT NULL REFERENCES tasks(id), "userId" TEXT NOT NULL REFERENCES users(id),
        note TEXT NOT NULL, "createdAt" TEXT NOT NULL
      );
      CREATE TABLE attachments (
        id TEXT PRIMARY KEY, "taskId" TEXT NOT NULL REFERENCES tasks(id), "submissionId" TEXT NOT NULL REFERENCES submissions(id),
        name TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, "storageKey" TEXT NOT NULL UNIQUE,
        checksum TEXT NOT NULL, "createdAt" TEXT NOT NULL
      );
      CREATE TABLE activities (
        id TEXT PRIMARY KEY, "taskId" TEXT NOT NULL REFERENCES tasks(id), "userId" TEXT NOT NULL REFERENCES users(id),
        kind TEXT NOT NULL, message TEXT NOT NULL, "createdAt" TEXT NOT NULL
      );
      CREATE TABLE audit_events (
        id TEXT PRIMARY KEY, "requestId" TEXT NOT NULL, "actorId" TEXT REFERENCES users(id), event TEXT NOT NULL,
        "targetType" TEXT NOT NULL DEFAULT '', "targetId" TEXT NOT NULL DEFAULT '', outcome TEXT NOT NULL,
        "ipHash" TEXT NOT NULL DEFAULT '', metadata TEXT NOT NULL DEFAULT '{}', "createdAt" TEXT NOT NULL
      );
      CREATE TABLE data_imports (
        id TEXT PRIMARY KEY, checksum TEXT NOT NULL, "createdAt" TEXT NOT NULL
      );
      CREATE INDEX sessions_expires ON sessions(expires);
      CREATE INDEX sessions_user ON sessions("userId");
      CREATE INDEX login_attempts_reset ON login_attempts("resetAt");
      CREATE INDEX tasks_assignee ON tasks("assigneeId");
      CREATE INDEX tasks_status_due ON tasks(status,"dueDate");
      CREATE INDEX tasks_assignee_due ON tasks("assigneeId","dueDate");
      CREATE INDEX submissions_task ON submissions("taskId");
      CREATE INDEX attachments_task ON attachments("taskId");
      CREATE INDEX attachments_submission ON attachments("submissionId");
      CREATE INDEX activities_task ON activities("taskId");
      CREATE INDEX audit_events_created ON audit_events("createdAt");
      CREATE INDEX audit_events_actor ON audit_events("actorId","createdAt");
    `,
  },
];

const checksum = (migration: Migration) => createHash("sha256").update(`${migration.version}:${migration.name}:${migration.sql}`).digest("hex");

type Queryable = { query<R extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<R>> };

async function appliedMigrations(connection: Queryable): Promise<AppliedMigration[]> {
  const exists = await connection.query<{ exists: boolean }>("SELECT to_regclass('schema_migrations') IS NOT NULL AS exists");
  if (!exists.rows[0]?.exists) return [];
  return (await connection.query<AppliedMigration>('SELECT version,name,checksum,"appliedAt" FROM schema_migrations ORDER BY version')).rows;
}

function verifyApplied(applied: AppliedMigration[]) {
  for (const record of applied) {
    const migration = migrations.find(item => item.version === record.version);
    if (!migration) throw new Error(`Database migration ${record.version} is newer than this application.`);
    if (record.name !== migration.name || record.checksum !== checksum(migration)) throw new Error(`Database migration ${record.version} does not match the application migration history.`);
  }
}

export async function migrationStatus(connection: Queryable) {
  const applied = await appliedMigrations(connection);
  verifyApplied(applied);
  return { current: applied.at(-1)?.version ?? 0, latest: migrations.at(-1)?.version ?? 0, applied };
}

export async function migratePostgres() {
  const connection = new Client({ connectionString: migrationDatabaseUrl() });
  await connection.connect();
  try {
    await connection.query("BEGIN");
    await connection.query("SELECT pg_advisory_xact_lock(hashtext('achitpharma-schema-migrations'))");
    await connection.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, checksum TEXT NOT NULL, "appliedAt" TEXT NOT NULL
    )`);
    const applied = await appliedMigrations(connection);
    verifyApplied(applied);
    const versions = new Set(applied.map(item => item.version));
    const newlyApplied: number[] = [];
    for (const migration of migrations) {
      if (versions.has(migration.version)) continue;
      await connection.query(migration.sql);
      await connection.query('INSERT INTO schema_migrations(version,name,checksum,"appliedAt") VALUES($1,$2,$3,$4)', [migration.version,migration.name,checksum(migration),new Date().toISOString()]);
      newlyApplied.push(migration.version);
    }
    await connection.query("COMMIT");
    return { applied: newlyApplied, status: await migrationStatus(connection) };
  } catch (error) {
    await connection.query("ROLLBACK");
    throw error;
  } finally {
    await connection.end();
  }
}

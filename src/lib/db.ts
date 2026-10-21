import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

const globalDb = globalThis as unknown as { achitDb?: DatabaseSync };
export function db() {
  if (globalDb.achitDb) return globalDb.achitDb;
  const directory = process.env.DATA_DIR || path.join(process.cwd(), "data");
  mkdirSync(directory, { recursive: true });
  const connection = new DatabaseSync(path.join(directory, "workspace.sqlite"));
  connection.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
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
  `);
  globalDb.achitDb = connection;
  return connection;
}
export function transaction<T>(fn: () => T): T {
  const connection = db();
  connection.exec("BEGIN IMMEDIATE");
  try { const result = fn(); connection.exec("COMMIT"); return result; }
  catch (error) { connection.exec("ROLLBACK"); throw error; }
}

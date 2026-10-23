import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { migrate } from "./migrations";

const globalDb = globalThis as unknown as { achitDb?: DatabaseSync };
export function db() {
  if (globalDb.achitDb) return globalDb.achitDb;
  const directory = process.env.DATA_DIR || path.join(process.cwd(), "data");
  mkdirSync(directory, { recursive: true });
  const databasePath = path.join(directory, "workspace.sqlite");
  const connection = new DatabaseSync(databasePath);
  try {
    connection.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
    migrate(connection, { databasePath, dataDirectory: directory });
  } catch (error) {
    connection.close();
    throw error;
  }
  globalDb.achitDb = connection;
  return connection;
}
export function transaction<T>(fn: () => T): T {
  const connection = db();
  connection.exec("BEGIN IMMEDIATE");
  try { const result = fn(); connection.exec("COMMIT"); return result; }
  catch (error) { connection.exec("ROLLBACK"); throw error; }
}

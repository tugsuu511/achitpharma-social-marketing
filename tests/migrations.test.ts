import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { migrate, migrationStatus } from "../src/lib/migrations";

test("legacy database is backed up and upgraded with immutable versioned migrations", t => {
  const root = mkdtempSync(path.join(tmpdir(), "achitpharma-migration-test-"));
  t.after(() => {
    assert.ok(root.startsWith(path.resolve(tmpdir()) + path.sep));
    rmSync(root, { recursive: true, force: true });
  });
  const dataDirectory = path.join(root, "data");
  const backupDirectory = path.join(root, "backups");
  const databasePath = path.join(dataDirectory, "workspace.sqlite");
  mkdirSync(dataDirectory);
  const connection = new DatabaseSync(databasePath);
  try {
    connection.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; CREATE TABLE users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE COLLATE NOCASE,password TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('admin','employee')),title TEXT NOT NULL DEFAULT '',active INTEGER NOT NULL DEFAULT 1,createdAt TEXT NOT NULL); INSERT INTO users VALUES('u1','Legacy User','legacy@example.test','hash','admin','',1,'2026-01-01T00:00:00.000Z');");
    const result = migrate(connection, { databasePath, dataDirectory, backupDirectory });
    assert.deepEqual(result.applied, [1, 2, 3, 4, 5]);
    assert.ok(result.backupPath && existsSync(result.backupPath));
    assert.ok(existsSync(`${result.backupPath}.json`));
    assert.equal((connection.prepare("SELECT name FROM users WHERE id='u1'").get() as { name: string }).name, "Legacy User");
    assert.deepEqual(migrationStatus(connection).current, 5);
    assert.ok(connection.prepare("SELECT 1 FROM sqlite_schema WHERE type='table' AND name='audit_events'").get());
    assert.deepEqual(connection.prepare("PRAGMA table_info(attachments)").all().map((column: unknown) => (column as { name: string }).name).includes("data"), false);
    for (const index of ["sessions_expires","sessions_user","login_attempts_reset","tasks_status_due","tasks_assignee_due","submissions_task","attachments_submission"]) {
      assert.ok(connection.prepare("SELECT 1 FROM sqlite_schema WHERE type='index' AND name=?").get(index), index);
    }
    const backupCount = readdirSync(backupDirectory).length;
    assert.deepEqual(migrate(connection, { databasePath, dataDirectory, backupDirectory }), { applied: [], backupPath: null });
    assert.equal(readdirSync(backupDirectory).length, backupCount);
  } finally {
    connection.close();
  }
});

test("new database migrates without creating a pointless backup", t => {
  const root = mkdtempSync(path.join(tmpdir(), "achitpharma-new-database-test-"));
  t.after(() => {
    assert.ok(root.startsWith(path.resolve(tmpdir()) + path.sep));
    rmSync(root, { recursive: true, force: true });
  });
  const databasePath = path.join(root, "workspace.sqlite");
  const connection = new DatabaseSync(databasePath);
  try {
    const result = migrate(connection, { databasePath, dataDirectory: root, backupDirectory: path.join(root, "..", "backups") });
    assert.deepEqual(result, { applied: [1, 2, 3, 4, 5], backupPath: null });
  } finally {
    connection.close();
  }
});

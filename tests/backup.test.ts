import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

test("online backup includes WAL data and restores into an isolated directory", t => {
  const root = mkdtempSync(path.join(tmpdir(), "achitpharma-backup-test-"));
  t.after(() => {
    assert.ok(root.startsWith(path.resolve(tmpdir()) + path.sep));
    rmSync(root, { recursive: true, force: true });
  });

  const dataDirectory = path.join(root, "data");
  const backupDirectory = path.join(root, "backups");
  const restoreDirectory = path.join(root, "restored");
  mkdirSync(dataDirectory);

  const source = new DatabaseSync(path.join(dataDirectory, "workspace.sqlite"));
  source.exec("PRAGMA journal_mode=WAL; CREATE TABLE marker(value TEXT NOT NULL); INSERT INTO marker VALUES('restored-value');");
  mkdirSync(path.join(dataDirectory,"files","evidence","aa"),{ recursive: true });
  writeFileSync(path.join(dataDirectory,"files","evidence","aa","private-file"),"private-evidence");

  const run = (script: string, args: string[]) => spawnSync(process.execPath, ["--import", "tsx", path.join(process.cwd(), "scripts", script), ...args], {
    cwd: process.cwd(),
    env: { ...process.env, DATA_DIR: dataDirectory },
    encoding: "utf8",
    windowsHide: true,
  });

  try {
    const created = run("db-backup.ts", ["--output-dir", backupDirectory]);
    assert.equal(created.status, 0, created.stderr || created.stdout);
    const backupFile = readdirSync(backupDirectory).find(name => name.endsWith(".sqlite"));
    assert.ok(backupFile);

    const restored = run("db-restore.ts", ["--from", path.join(backupDirectory, backupFile), "--target-dir", restoreDirectory]);
    assert.equal(restored.status, 0, restored.stderr || restored.stdout);

    const result = new DatabaseSync(path.join(restoreDirectory, "workspace.sqlite"), { readOnly: true });
    try {
      assert.equal((result.prepare("SELECT value FROM marker").get() as { value: string }).value, "restored-value");
      assert.equal(readFileSync(path.join(restoreDirectory,"files","evidence","aa","private-file"),"utf8"),"private-evidence");
    } finally {
      result.close();
    }
  } finally {
    source.close();
  }
});

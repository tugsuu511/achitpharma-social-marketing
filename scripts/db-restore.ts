import { createHash } from "node:crypto";
import { cpSync, createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { backup, DatabaseSync } from "node:sqlite";

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function loadEnvironment() {
  for (const filename of [".env.local", ".env"]) {
    if (existsSync(filename)) process.loadEnvFile(filename);
  }
}

function isInside(parent: string, child: string) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function sha256(filename: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filename)) hash.update(chunk);
  return hash.digest("hex");
}

function verifyDatabase(filename: string) {
  const connection = new DatabaseSync(filename, { readOnly: true });
  try {
    const result = connection.prepare("PRAGMA quick_check").get() as Record<string, unknown>;
    if (Object.values(result)[0] !== "ok") throw new Error("Database integrity check failed.");
  } finally {
    connection.close();
  }
}

type Manifest = { filename?: string; sha256?: string; filesDirectory?: string; files?: { key: string; bytes: number; sha256: string }[] };

async function verifyManifest(source: string): Promise<Manifest> {
  const manifestPath = `${source}.json`;
  if (!existsSync(manifestPath)) throw new Error(`Backup manifest not found: ${manifestPath}`);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
  if (manifest.filename !== path.basename(source) || !manifest.sha256) throw new Error("Backup manifest is invalid.");
  if (await sha256(source) !== manifest.sha256) throw new Error("Backup checksum does not match its manifest.");
  if (manifest.filesDirectory || manifest.files) {
    if (!manifest.filesDirectory || !manifest.files || path.basename(manifest.filesDirectory) !== manifest.filesDirectory) throw new Error("Backup file manifest is invalid.");
    const filesDirectory = path.join(path.dirname(source), manifest.filesDirectory);
    for (const item of manifest.files) {
      const filename = path.resolve(filesDirectory, ...item.key.split("/"));
      if (!filename.startsWith(path.resolve(filesDirectory) + path.sep) || !existsSync(filename) || statSync(filename).size !== item.bytes || await sha256(filename) !== item.sha256) throw new Error(`Private backup file failed validation: ${item.key}`);
    }
  }
  return manifest;
}

async function main() {
  loadEnvironment();
  const sourceArgument = argument("--from");
  const targetArgument = argument("--target-dir");
  const targetFilesArgument = argument("--target-files-dir");
  if (!sourceArgument || !targetArgument) throw new Error("Usage: npm.cmd run db:restore -- --from <backup.sqlite> --target-dir <empty-directory> [--target-files-dir <new-directory>]");

  const source = path.resolve(sourceArgument);
  const targetDirectory = path.resolve(targetArgument);
  const liveDataDirectory = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), "data"));
  const liveFilesDirectory = path.resolve(process.env.PRIVATE_FILES_DIR || path.join(liveDataDirectory,"files"));
  const targetFiles = path.resolve(targetFilesArgument || path.join(targetDirectory,"files"));
  if (!existsSync(source)) throw new Error(`Backup not found: ${source}`);
  if (isInside(liveDataDirectory, targetDirectory)) throw new Error("Restore target must be outside the active DATA_DIR.");
  if (isInside(liveFilesDirectory,targetFiles) || isInside(targetFiles,liveFilesDirectory)) throw new Error("Restored private files must be separate from the active PRIVATE_FILES_DIR.");

  mkdirSync(targetDirectory, { recursive: true });
  if (readdirSync(targetDirectory).length) throw new Error("Restore target directory must be empty.");
  if (targetFiles !== path.join(targetDirectory,"files") && existsSync(targetFiles)) throw new Error("Restore private-files target must not already exist.");

  const manifest = await verifyManifest(source);
  verifyDatabase(source);

  const destination = path.join(targetDirectory, "workspace.sqlite");
  const temporary = `${destination}.restore-${process.pid}.tmp`;
  const sourceDatabase = new DatabaseSync(source, { readOnly: true });
  try {
    await backup(sourceDatabase, temporary);
    verifyDatabase(temporary);
    renameSync(temporary, destination);
    if (manifest.filesDirectory) cpSync(path.join(path.dirname(source), manifest.filesDirectory), targetFiles, { recursive: true, errorOnExist: true, force: false });
    else mkdirSync(targetFiles, { recursive: true });
    console.log(`Restore verified: ${destination}`);
    console.log(`Start the server with DATA_DIR=${targetDirectory}`);
    if (targetFilesArgument) console.log(`Set PRIVATE_FILES_DIR=${targetFiles}`);
  } finally {
    sourceDatabase.close();
    if (existsSync(temporary)) rmSync(temporary);
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : "Restore failed.");
  process.exitCode = 1;
});

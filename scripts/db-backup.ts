import { createHash, randomBytes } from "node:crypto";
import { cpSync, createReadStream, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { backup, DatabaseSync } from "node:sqlite";
import { privateFilesDirectory } from "../src/lib/storage";

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

async function fileManifest(directory: string, current = directory): Promise<{ key: string; bytes: number; sha256: string }[]> {
  const result: { key: string; bytes: number; sha256: string }[] = [];
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const filename = path.join(current, entry.name);
    if (entry.isDirectory()) result.push(...await fileManifest(directory, filename));
    else if (entry.isFile()) result.push({ key: path.relative(directory, filename).replaceAll(path.sep, "/"), bytes: statSync(filename).size, sha256: await sha256(filename) });
  }
  return result;
}

function verifyDatabase(filename: string) {
  const connection = new DatabaseSync(filename, { readOnly: true });
  try {
    const result = connection.prepare("PRAGMA quick_check").get() as Record<string, unknown>;
    if (Object.values(result)[0] !== "ok") throw new Error("Backup database integrity check failed.");
  } finally {
    connection.close();
  }
}

async function main() {
  loadEnvironment();
  const dataDirectory = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), "data"));
  const outputDirectory = path.resolve(argument("--output-dir") || process.env.BACKUP_DIR || path.join(process.cwd(), "backups"));
  if (isInside(dataDirectory, outputDirectory)) throw new Error("Backup directory must be outside DATA_DIR.");

  const source = path.join(dataDirectory, "workspace.sqlite");
  if (!existsSync(source)) throw new Error(`Database not found: ${source}`);
  mkdirSync(outputDirectory, { recursive: true });

  const createdAt = new Date().toISOString();
  const stamp = createdAt.replaceAll(":", "-").replaceAll(".", "-");
  const filename = `workspace-${stamp}-${randomBytes(4).toString("hex")}.sqlite`;
  const destination = path.join(outputDirectory, filename);
  const temporary = `${destination}.tmp`;
  const sourceFiles = privateFilesDirectory(dataDirectory);
  const filesDirectoryName = `${filename}.files`;
  const destinationFiles = path.join(outputDirectory, filesDirectoryName);
  const sourceDatabase = new DatabaseSync(source, { readOnly: true });

  try {
    const pages = await backup(sourceDatabase, temporary);
    verifyDatabase(temporary);
    renameSync(temporary, destination);
    if (existsSync(sourceFiles)) cpSync(sourceFiles, destinationFiles, { recursive: true, errorOnExist: true, force: false });
    else mkdirSync(destinationFiles, { recursive: true });
    const checksum = await sha256(destination);
    const files = await fileManifest(destinationFiles);
    const manifest = { version: 2, createdAt, filename, bytes: statSync(destination).size, pages, sha256: checksum, filesDirectory: filesDirectoryName, files };
    writeFileSync(`${destination}.json`, JSON.stringify(manifest, null, 2) + "\n", { encoding: "utf8", flag: "wx" });
    console.log(`Backup created: ${destination}`);
    console.log(`SHA-256: ${checksum}`);
  } finally {
    sourceDatabase.close();
    if (existsSync(temporary)) rmSync(temporary);
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : "Backup failed.");
  process.exitCode = 1;
});

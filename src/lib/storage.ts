import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const KEY_PATTERN = /^evidence\/[a-f0-9]{2}\/[a-f0-9-]{16,64}$/;
export const fileDigest = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");

export function privateFilesDirectory(dataDirectory = process.env.DATA_DIR || path.join(process.cwd(), "data")) {
  const directory = path.resolve(/*turbopackIgnore: true*/ process.env.PRIVATE_FILES_DIR || path.join(dataDirectory, "files"));
  const publicDirectory = path.resolve(process.cwd(), "public");
  const relative = path.relative(publicDirectory, directory);
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) throw new Error("PRIVATE_FILES_DIR must not be inside public/.");
  return directory;
}

function pathForKey(key: string, dataDirectory?: string) {
  if (!KEY_PATTERN.test(key)) throw new Error("Invalid private storage key.");
  return path.join(privateFilesDirectory(dataDirectory), ...key.split("/"));
}

export function storeAttachment(id: string, data: Uint8Array, dataDirectory?: string) {
  const normalized = id.toLowerCase();
  if (!/^[a-f0-9-]{16,64}$/.test(normalized)) throw new Error("Invalid attachment identifier.");
  const key = `evidence/${normalized.slice(0, 2)}/${normalized}`;
  const destination = pathForKey(key, dataDirectory);
  const digest = fileDigest(data);
  mkdirSync(path.dirname(destination), { recursive: true });
  if (existsSync(destination)) {
    if (fileDigest(readFileSync(destination)) !== digest) throw new Error("Private file checksum conflict.");
    return { key, checksum: digest, created: false };
  }
  const temporary = `${destination}.${process.pid}-${randomBytes(4).toString("hex")}.tmp`;
  try {
    writeFileSync(temporary, data, { flag: "wx", mode: 0o600 });
    renameSync(temporary, destination);
  } catch (error) {
    if (existsSync(temporary)) rmSync(temporary, { force: true });
    throw error;
  }
  return { key, checksum: digest, created: true };
}

export function readAttachment(key: string, expectedChecksum: string, dataDirectory?: string) {
  const data = readFileSync(pathForKey(key, dataDirectory));
  if (fileDigest(data) !== expectedChecksum) throw new Error("Private file checksum validation failed.");
  return data;
}

export function removeAttachment(key: string, dataDirectory?: string) {
  rmSync(pathForKey(key, dataDirectory), { force: true });
}

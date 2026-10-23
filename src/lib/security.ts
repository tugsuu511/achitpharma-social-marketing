import { randomBytes, scrypt, timingSafeEqual, createHash } from "node:crypto";
export class AppError extends Error { constructor(message: string, public status = 400) { super(message); } }
const derive = (password: string, salt: string) => new Promise<Buffer>((resolve, reject) => scrypt(password, salt, 64, (error, result) => error ? reject(error) : resolve(result)));
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return "scrypt-v1$" + salt + "$" + (await derive(password, salt)).toString("hex");
}
export async function verifyPassword(password: string, hash: string) {
  const versioned = hash.startsWith("scrypt-v1$");
  const [salt, expected] = versioned ? hash.slice("scrypt-v1$".length).split("$") : hash.split(":");
  if (!salt || !expected) return false;
  const actual = await derive(password, salt);
  const buffer = Buffer.from(expected, "hex");
  return buffer.length === actual.length && timingSafeEqual(buffer, actual);
}
export const passwordNeedsRehash = (hash: string) => !hash.startsWith("scrypt-v1$");
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export function imageMime(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;
  if (buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "image/png";
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return "image/jpeg";
  if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}
export function csvCell(value: string) {
  const safe = /^[=+\-@\t\r\n]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

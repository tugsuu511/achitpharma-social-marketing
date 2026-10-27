import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { db } from "./db";
import { AppError, digest } from "./security";
import type { User } from "./types";
const COOKIE = "achit_session";
const IDLE_TIMEOUT_MS = 24 * 60 * 60 * 1000;
export const USER_COLUMNS = "id, name, email, role, title, active, createdAt";
export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const tokenHash = digest(token); const timestamp = Date.now();
  const user = (await db().prepare("SELECT u.id,u.name,u.email,u.role,u.title,u.active,u.createdAt,s.lastSeenAt FROM sessions s JOIN users u ON u.id=s.userId WHERE s.token=? AND s.expires>? AND s.lastSeenAt>? AND u.active=1").get<User & { lastSeenAt: number }>(tokenHash,timestamp,timestamp-IDLE_TIMEOUT_MS)) ?? null;
  if (user && timestamp-user.lastSeenAt > 300000) await db().prepare("UPDATE sessions SET lastSeenAt=? WHERE token=?").run(timestamp,tokenHash);
  if (!user) return null;
  const { lastSeenAt: _lastSeenAt, ...safeUser } = user; return safeUser;
}
export async function requireUser() { const user = await currentUser(); if (!user) throw new AppError("Үргэлжлүүлэхийн тулд нэвтэрнэ үү.", 401); return user; }
export function requireAdmin(user: User) { if (user.role !== "admin") throw new AppError("Зөвхөн админд зөвшөөрөгдөнө.", 403); }
export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const timestamp = Date.now(); await db().prepare("DELETE FROM sessions WHERE expires <= ? OR lastSeenAt <= ?").run(timestamp,timestamp-IDLE_TIMEOUT_MS);
  await db().prepare("INSERT INTO sessions(token,userId,expires,createdAt,lastSeenAt) VALUES(?,?,?,?,?)").run(digest(token),userId,timestamp+7*86400000,timestamp,timestamp);
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.COOKIE_SECURE === "true" || process.env.APP_ORIGIN?.startsWith("https://") === true, sameSite: "strict", path: "/", maxAge: 7 * 86400 });
}
export async function logout() {
  const jar = await cookies(); const token = jar.get(COOKIE)?.value;
  if (token) await db().prepare("DELETE FROM sessions WHERE token=?").run(digest(token));
  jar.delete(COOKIE);
}

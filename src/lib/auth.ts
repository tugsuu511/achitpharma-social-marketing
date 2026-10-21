import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { db } from "./db";
import { AppError, digest } from "./security";
import type { User } from "./types";
const COOKIE = "achit_session";
export const USER_COLUMNS = "id, name, email, role, title, active, createdAt";
export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  return (db().prepare(`SELECT u.id,u.name,u.email,u.role,u.title,u.active,u.createdAt FROM sessions s JOIN users u ON u.id=s.userId WHERE s.token=? AND s.expires>? AND u.active=1`).get(digest(token), Date.now()) as User | undefined) ?? null;
}
export async function requireUser() { const user = await currentUser(); if (!user) throw new AppError("Үргэлжлүүлэхийн тулд нэвтэрнэ үү.", 401); return user; }
export function requireAdmin(user: User) { if (user.role !== "admin") throw new AppError("Зөвхөн админд зөвшөөрөгдөнө.", 403); }
export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  db().prepare("DELETE FROM sessions WHERE expires < ?").run(Date.now());
  db().prepare("INSERT INTO sessions(token,userId,expires) VALUES(?,?,?)").run(digest(token), userId, Date.now() + 7 * 86400000);
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.COOKIE_SECURE === "true" || process.env.APP_ORIGIN?.startsWith("https://") === true, sameSite: "strict", path: "/", maxAge: 7 * 86400 });
}
export async function logout() {
  const jar = await cookies(); const token = jar.get(COOKIE)?.value;
  if (token) db().prepare("DELETE FROM sessions WHERE token=?").run(digest(token));
  jar.delete(COOKIE);
}

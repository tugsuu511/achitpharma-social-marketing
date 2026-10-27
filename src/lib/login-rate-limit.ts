import { createHmac } from "node:crypto";
import { db } from "./db";
import { context } from "./request-context";
import { AppError } from "./security";

const WINDOW_MS = 15 * 60 * 1000;
type LimitKey = { key: string; maximum: number; clearOnSuccess: boolean };

function key(scope: string, value: string) {
  return createHmac("sha256", process.env.IP_HASH_SECRET || "development-rate-limit-key").update(scope + ":" + value).digest("hex");
}

export async function recordLoginAttempt(email: string) {
  const ip = context().ipHash;
  const limits: LimitKey[] = [
    { key: key("account",email), maximum: 20, clearOnSuccess: true },
    { key: key("ip",ip), maximum: 30, clearOnSuccess: true },
    { key: key("pair",email + ":" + ip), maximum: 8, clearOnSuccess: true },
  ];
  const now = Date.now();
  await db().prepare("DELETE FROM login_attempts WHERE resetAt <= ?").run(now);
  for (const limit of limits) {
    const attempt = await db().prepare("SELECT attempts,resetAt FROM login_attempts WHERE key=?").get<{ attempts: number; resetAt: number }>(limit.key);
    if (attempt && attempt.resetAt > now && attempt.attempts >= limit.maximum) throw new AppError("Олон удаа буруу оролдлоо. 15 минутын дараа дахин оролдоно уу.",429);
  }
  for (const limit of limits) await db().prepare("INSERT INTO login_attempts(key,attempts,resetAt) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=login_attempts.attempts+1").run(limit.key,now+WINDOW_MS);
  return limits;
}

export async function clearSuccessfulLogin(limits: LimitKey[]) {
  const remove = db().prepare("DELETE FROM login_attempts WHERE key=?");
  for (const limit of limits) if (limit.clearOnSuccess) await remove.run(limit.key);
}

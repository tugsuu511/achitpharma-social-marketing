import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { closeDatabase, db } from "../src/lib/db";
import { digest } from "../src/lib/security";

for (const filename of [".env.production.local", ".env.local", ".env.production", ".env"]) {
  if (existsSync(filename)) process.loadEnvFile(filename);
}

async function main() {
  const origin = process.env.SMOKE_ORIGIN || "http://127.0.0.1:3100";
  const hostname = new URL(origin).hostname;
  if (!['localhost','127.0.0.1','[::1]'].includes(hostname)) throw new Error("SMOKE_ORIGIN must be a loopback address.");
  const user = await db().prepare("SELECT id FROM users WHERE active=1 ORDER BY role,id LIMIT 1").get<{ id: string }>();
  if (!user) throw new Error("Neon smoke test requires one active imported user.");
  const token = randomBytes(32).toString("hex");
  const tokenHash = digest(token);
  const now = Date.now();
  await db().prepare("INSERT INTO sessions(token,userId,expires,createdAt,lastSeenAt) VALUES(?,?,?,?,?)").run(tokenHash,user.id,now+300_000,now,now);
  try {
    const ready = await fetch(`${origin}/ready`);
    const readyBody = await ready.json() as { status?: string };
    if (ready.status !== 200 || readyBody.status !== "ready") throw new Error(`Readiness failed: ${ready.status}`);
    const headers = { Cookie: `achit_session=${token}` };
    const workspace = await fetch(`${origin}/api/workspace`,{ headers });
    const workspaceBody = await workspace.json() as { user?: { id?: string }; tasks?: unknown[] };
    if (workspace.status !== 200 || workspaceBody.user?.id !== user.id || !Array.isArray(workspaceBody.tasks)) throw new Error(`Authenticated workspace failed: ${workspace.status}`);
    const home = await fetch(origin,{ headers });
    const html = await home.text();
    if (home.status !== 200 || !html.includes('class="app-layout"') || html.includes('class="auth-layout"')) throw new Error(`Authenticated page render failed: ${home.status}`);
    console.log(JSON.stringify({ status: "ok", checks: { readiness: ready.status, authenticatedApi: workspace.status, authenticatedPage: home.status }, taskCount: workspaceBody.tasks.length },null,2));
  } finally {
    await db().prepare("DELETE FROM sessions WHERE token=?").run(tokenHash);
    await closeDatabase();
  }
}

main().catch(async error => { console.error(error instanceof Error ? error.message : "Neon smoke test failed."); process.exitCode = 1; await closeDatabase(); });

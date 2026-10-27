import { randomUUID } from "node:crypto";
import { db } from "./db";
import { context } from "./request-context";

type AuditInput = { actorId?: string | null; targetType?: string; targetId?: string; outcome?: "success" | "failure" | "blocked"; metadata?: Record<string, string | number | boolean | null> };

export async function audit(event: string, input: AuditInput = {}) {
  const request = context();
  const metadata = JSON.stringify(input.metadata || {});
  await db().prepare("INSERT INTO audit_events(id,requestId,actorId,event,targetType,targetId,outcome,ipHash,metadata,createdAt) VALUES(?,?,?,?,?,?,?,?,?,?)")
    .run(randomUUID(),request.requestId,input.actorId || null,event,input.targetType || "",input.targetId || "",input.outcome || "success",request.ipHash,metadata.length <= 3000 ? metadata : "{}",new Date().toISOString());
}

import { db } from "./db";
import { AppError } from "./security";

type AuditCursor = { createdAt: string; id: string };
type AuditRow = { id: string; requestId: string; actorId: string | null; actorName: string | null; event: string; targetType: string; targetId: string; outcome: string; metadata: string; createdAt: string };

export async function auditPage(url: URL) {
  const limit = Number(url.searchParams.get("limit") || 50);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new AppError("limit 1–100 хооронд байна.");
  let cursor: AuditCursor | null = null;
  const raw = url.searchParams.get("cursor");
  if (raw) try {
    cursor = JSON.parse(Buffer.from(raw,"base64url").toString("utf8")) as AuditCursor;
    if (typeof cursor.createdAt !== "string" || typeof cursor.id !== "string") throw new Error();
  } catch { throw new AppError("Audit cursor буруу байна."); }
  const rows = await db().prepare(`SELECT a.id,a.requestId,a.actorId,u.name AS actorName,a.event,a.targetType,a.targetId,a.outcome,a.metadata,a.createdAt FROM audit_events a LEFT JOIN users u ON u.id=a.actorId ${cursor ? "WHERE (a.createdAt < ? OR (a.createdAt = ? AND a.id < ?))" : ""} ORDER BY a.createdAt DESC,a.id DESC LIMIT ?`).all<AuditRow>(...(cursor ? [cursor.createdAt,cursor.createdAt,cursor.id] : []),limit + 1);
  const hasMore = rows.length > limit;
  const items = rows.slice(0,limit).map(row => { let metadata: unknown = {}; try { metadata = JSON.parse(row.metadata); } catch {} return { ...row, metadata }; });
  const last = items.at(-1);
  return { items, nextCursor: hasMore && last ? Buffer.from(JSON.stringify({ createdAt: last.createdAt, id: last.id })).toString("base64url") : null };
}

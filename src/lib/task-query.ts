import { db } from "./db";
import { AppError } from "./security";
import { todayInMongolia, type Status, type Task, type User } from "./types";

type Cursor = { createdAt: string; id: string };

function decodeCursor(value: string | null): Cursor | null {
  if (!value) return null;
  try {
    const cursor = JSON.parse(Buffer.from(value,"base64url").toString("utf8")) as Cursor;
    if (typeof cursor.createdAt !== "string" || typeof cursor.id !== "string") throw new Error();
    return cursor;
  } catch { throw new AppError("Хуудасны cursor буруу байна."); }
}

function encodeCursor(task: Task) {
  return Buffer.from(JSON.stringify({ createdAt: task.createdAt, id: task.id })).toString("base64url");
}

export async function taskPage(user: User, url: URL) {
  const rawLimit = Number(url.searchParams.get("limit") || 30);
  if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 100) throw new AppError("limit 1–100 хооронд байна.");
  const status = url.searchParams.get("status");
  const allowed = new Set<Status | "overdue">(["planned","in_progress","submitted","revision","approved","overdue"]);
  if (status && !allowed.has(status as Status | "overdue")) throw new AppError("Төлөвийн шүүлт буруу байна.");
  const assignee = url.searchParams.get("assignee");
  const query = (url.searchParams.get("q") || "").trim().slice(0,100);
  const cursor = decodeCursor(url.searchParams.get("cursor"));
  const conditions: string[] = [];
  const parameters: Array<string | number> = [];
  if (user.role !== "admin") { conditions.push("t.assigneeId=?"); parameters.push(user.id); }
  else if (assignee) { conditions.push("t.assigneeId=?"); parameters.push(assignee); }
  if (status === "overdue") { conditions.push("t.dueDate < ? AND t.status <> 'approved'"); parameters.push(todayInMongolia()); }
  else if (status) { conditions.push("t.status=?"); parameters.push(status); }
  if (query) { conditions.push("(t.title ILIKE ? OR t.description ILIKE ? OR u.name ILIKE ?)"); parameters.push(...Array(3).fill(`%${query}%`)); }
  if (cursor) { conditions.push("(t.createdAt < ? OR (t.createdAt = ? AND t.id < ?))"); parameters.push(cursor.createdAt,cursor.createdAt,cursor.id); }
  const rows = await db().prepare(`SELECT t.id,t.title,t.description,t.assigneeId,u.name AS assigneeName,t.platform,t.priority,t.dueDate,t.status,t.createdAt,t.updatedAt,t.approvedAt,(SELECT COUNT(*) FROM attachments a WHERE a.taskId=t.id) AS attachmentCount FROM tasks t JOIN users u ON u.id=t.assigneeId ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""} ORDER BY t.createdAt DESC,t.id DESC LIMIT ?`).all<Task>(...parameters,rawLimit + 1);
  const hasMore = rows.length > rawLimit;
  const items = rows.slice(0,rawLimit).map(task => ({ ...task, attachments: [], activities: [] }));
  return { items, nextCursor: hasMore ? encodeCursor(items.at(-1)!) : null };
}

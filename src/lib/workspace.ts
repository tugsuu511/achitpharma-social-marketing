import { db } from "./db";
import { AppError } from "./security";
import { USER_COLUMNS } from "./auth";
import { todayInMongolia, type User, type Task, type Workspace, type Activity, type Attachment } from "./types";
export function accessibleTask(id: string, user: User): Task {
  const task = db().prepare("SELECT t.*,u.name AS assigneeName,(SELECT COUNT(*) FROM attachments a WHERE a.taskId=t.id) AS attachmentCount FROM tasks t JOIN users u ON u.id=t.assigneeId WHERE t.id=?").get(id) as Task | undefined;
  if (!task || (user.role !== "admin" && task.assigneeId !== user.id)) throw new AppError("Ажил олдсонгүй.", 404);
  return { ...task, attachments: [], activities: [] };
}
export function taskDetail(id: string, user: User): Task {
  const task = accessibleTask(id,user);
  const attachments = db().prepare("SELECT id,taskId,submissionId,name,mime,size,createdAt FROM attachments WHERE taskId=? ORDER BY createdAt DESC").all(id) as unknown as Attachment[];
  const activities = db().prepare("SELECT a.*,u.name FROM activities a JOIN users u ON u.id=a.userId WHERE a.taskId=? ORDER BY a.createdAt DESC,a.rowid DESC").all(id) as unknown as Activity[];
  return { ...task, attachments: attachments.map(item => ({ ...item })), activities: activities.map(item => ({ ...item })) };
}
export function workspace(user: User, since?: string): Workspace {
  const admin = user.role === "admin";
  const syncedAt = new Date().toISOString();
  // Admins can merge changed tasks safely because tasks are never deleted.
  // Employees receive a complete (already scoped) list so reassigned work is removed.
  const incremental = user.role === "admin" && !!since && !Number.isNaN(Date.parse(since));
  const conditions = [admin ? "" : "t.assigneeId=?", incremental ? "t.updatedAt > ? AND t.updatedAt <= ?" : ""].filter(Boolean);
  const parameters: string[] = [...(admin ? [] : [user.id]), ...(incremental ? [since!,syncedAt] : [])];
  const tasks = db().prepare(`SELECT t.id,t.title,t.description,t.assigneeId,u.name AS assigneeName,t.platform,t.priority,t.dueDate,t.status,t.createdAt,t.updatedAt,t.approvedAt,(SELECT COUNT(*) FROM attachments a WHERE a.taskId=t.id) AS attachmentCount FROM tasks t JOIN users u ON u.id=t.assigneeId ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""} ORDER BY t.dueDate ASC,t.createdAt DESC`).all(...parameters) as unknown as Task[];
  const users = admin ? db().prepare(`SELECT ${USER_COLUMNS} FROM users ORDER BY createdAt`).all() as User[] : [user];
  return {
    user: { ...user },
    users: users.map(item => ({ ...item })),
    tasks: tasks.map(t => ({ ...t, attachments: [], activities: [] })),
    today: todayInMongolia(),
    syncedAt,
    incremental,
  };
}

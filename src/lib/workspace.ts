import { db } from "./db";
import { AppError } from "./security";
import { USER_COLUMNS } from "./auth";
import { todayInMongolia, type User, type Task, type Workspace, type Activity, type Attachment } from "./types";
export async function accessibleTask(id: string, user: User): Promise<Task> {
  const task = await db().prepare("SELECT t.*,u.name AS assigneeName,(SELECT COUNT(*) FROM attachments a WHERE a.taskId=t.id) AS attachmentCount FROM tasks t JOIN users u ON u.id=t.assigneeId WHERE t.id=?").get<Task>(id);
  if (!task || (user.role !== "admin" && task.assigneeId !== user.id)) throw new AppError("Ажил олдсонгүй.", 404);
  return { ...task, attachments: [], activities: [] };
}
export async function taskDetail(id: string, user: User): Promise<Task> {
  const task = await accessibleTask(id,user);
  const attachments = await db().prepare("SELECT id,taskId,submissionId,name,mime,size,createdAt FROM attachments WHERE taskId=? ORDER BY createdAt DESC").all<Attachment>(id);
  const activities = await db().prepare("SELECT a.*,u.name FROM activities a JOIN users u ON u.id=a.userId WHERE a.taskId=? ORDER BY a.createdAt DESC,a.id DESC").all<Activity>(id);
  return { ...task, attachments: attachments.map(item => ({ ...item })), activities: activities.map(item => ({ ...item })) };
}
export async function workspace(user: User, since?: string): Promise<Workspace> {
  const admin = user.role === "admin";
  const syncedAt = new Date().toISOString();
  // Admins can merge changed tasks safely because tasks are never deleted.
  // Employees receive a complete (already scoped) list so reassigned work is removed.
  const incremental = user.role === "admin" && !!since && !Number.isNaN(Date.parse(since));
  const conditions = [admin ? "" : "t.assigneeId=?", incremental ? "t.updatedAt > ? AND t.updatedAt <= ?" : ""].filter(Boolean);
  const parameters: string[] = [...(admin ? [] : [user.id]), ...(incremental ? [since!,syncedAt] : [])];
  const tasks = await db().prepare(`SELECT t.id,t.title,t.description,t.assigneeId,u.name AS assigneeName,t.platform,t.priority,t.dueDate,t.status,t.createdAt,t.updatedAt,t.approvedAt,(SELECT COUNT(*) FROM attachments a WHERE a.taskId=t.id) AS attachmentCount FROM tasks t JOIN users u ON u.id=t.assigneeId ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""} ORDER BY t.dueDate ASC,t.createdAt DESC`).all<Task>(...parameters);
  const users = admin ? await db().prepare(`SELECT ${USER_COLUMNS} FROM users ORDER BY createdAt`).all<User>() : [user];
  return {
    user: { ...user },
    users: users.map(item => ({ ...item })),
    tasks: tasks.map(t => ({ ...t, attachments: [], activities: [] })),
    today: todayInMongolia(),
    syncedAt,
    incremental,
  };
}

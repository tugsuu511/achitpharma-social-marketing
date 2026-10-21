import { db } from "./db";
import { AppError } from "./security";
import { USER_COLUMNS } from "./auth";
import { todayInMongolia, type User, type Task, type Workspace, type Activity, type Attachment } from "./types";
export function accessibleTask(id: string, user: User): Task {
  const task = db().prepare("SELECT t.*,u.name AS assigneeName FROM tasks t JOIN users u ON u.id=t.assigneeId WHERE t.id=?").get(id) as Task | undefined;
  if (!task || (user.role !== "admin" && task.assigneeId !== user.id)) throw new AppError("Ажил олдсонгүй.", 404);
  return task;
}
export function workspace(user: User): Workspace {
  const admin = user.role === "admin";
  const tasks = db().prepare(`SELECT t.id,t.title,t.description,t.assigneeId,u.name AS assigneeName,t.platform,t.priority,t.dueDate,t.status,t.createdAt,t.updatedAt,t.approvedAt FROM tasks t JOIN users u ON u.id=t.assigneeId ${admin ? "" : "WHERE t.assigneeId=?"} ORDER BY t.dueDate ASC,t.createdAt DESC`).all(...(admin ? [] : [user.id])) as unknown as Task[];
  const attachments = db().prepare(`SELECT a.id,a.taskId,a.submissionId,a.name,a.mime,a.size,a.createdAt FROM attachments a JOIN tasks t ON t.id=a.taskId ${admin ? "" : "WHERE t.assigneeId=?"} ORDER BY a.createdAt DESC`).all(...(admin ? [] : [user.id])) as unknown as Attachment[];
  const activities = db().prepare(`SELECT a.*,u.name FROM activities a JOIN users u ON u.id=a.userId JOIN tasks t ON t.id=a.taskId ${admin ? "" : "WHERE t.assigneeId=?"} ORDER BY a.createdAt DESC,a.rowid DESC`).all(...(admin ? [] : [user.id])) as unknown as Activity[];
  const attachmentMap = new Map<string, Attachment[]>(); const activityMap = new Map<string, Activity[]>();
  // node:sqlite returns null-prototype rows. Normalize every row crossing the
  // React Server/Client boundary, including rows nested in task collections.
  for (const item of attachments) attachmentMap.set(item.taskId, [...(attachmentMap.get(item.taskId) || []), { ...item }]);
  for (const item of activities) activityMap.set(item.taskId, [...(activityMap.get(item.taskId) || []), { ...item }]);
  const users = admin ? db().prepare(`SELECT ${USER_COLUMNS} FROM users ORDER BY createdAt`).all() as User[] : [user];
  return {
    user: { ...user },
    users: users.map(item => ({ ...item })),
    tasks: tasks.map(t => ({ ...t, attachments: attachmentMap.get(t.id) || [], activities: activityMap.get(t.id) || [] })),
    today: todayInMongolia(),
  };
}

export type Role = "admin" | "employee";
export type Status = "planned" | "in_progress" | "submitted" | "revision" | "approved";
export type Platform = "Facebook" | "Instagram" | "TikTok" | "YouTube" | "Бусад";
export type User = { id: string; name: string; email: string; role: Role; title: string; active: number; createdAt: string };
export type Attachment = { id: string; taskId: string; submissionId: string; name: string; mime: string; size: number; createdAt: string };
export type Activity = { id: string; taskId: string; userId: string; name: string; kind: string; message: string; createdAt: string };
export type Task = { id: string; title: string; description: string; assigneeId: string; assigneeName: string; platform: Platform; priority: "normal" | "high"; dueDate: string; status: Status; createdAt: string; updatedAt: string; approvedAt: string | null; attachmentCount: number; attachments: Attachment[]; activities: Activity[] };
export type Workspace = { user: User; users: User[]; tasks: Task[]; today: string; syncedAt: string; incremental: boolean };
export const STATUS_LABEL: Record<Status, string> = { planned: "Төлөвлөсөн", in_progress: "Хийгдэж буй", submitted: "Хянуулах", revision: "Засварлах", approved: "Баталсан" };
export const PLATFORMS: Platform[] = ["Facebook", "Instagram", "TikTok", "YouTube", "Бусад"];
export function todayInMongolia() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ulaanbaatar", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
export function shortDate(date: string) { const [, month, day] = date.slice(0, 10).split("-"); return `${Number(month)} сарын ${Number(day)}`; }
export function isOverdue(task: Task, today: string) { return task.dueDate < today && task.status !== "approved"; }

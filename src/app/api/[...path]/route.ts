import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db, transaction } from "@/lib/db";
import { createSession, logout, requireAdmin, requireUser } from "@/lib/auth";
import { AppError, csvCell, hashPassword, imageMime, passwordNeedsRehash, verifyPassword } from "@/lib/security";
import { accessibleTask, taskDetail, workspace } from "@/lib/workspace";
import { STATUS_LABEL, type User } from "@/lib/types";
import { readAttachment, removeAttachment, storeAttachment } from "@/lib/storage";
import { audit } from "@/lib/audit";
import { clearSuccessfulLogin, recordLoginAttempt } from "@/lib/login-rate-limit";
import { log, withRequestContext } from "@/lib/request-context";
import { taskPage } from "@/lib/task-query";
import { auditPage } from "@/lib/audit-query";

export const runtime = "nodejs";
type Context = { params: Promise<{ path: string[] }> };
const email = z.string().trim().toLowerCase().email("Зөв имэйл хаяг оруулна уу.").max(254);
const password = z.string().min(10, "Нууц үг 10-аас доошгүй тэмдэгттэй байна.").max(128);
const person = z.object({ name: z.string().trim().min(2, "Нэрээ оруулна уу.").max(100), email, password, title: z.string().trim().max(100).default("") });
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => { const d = new Date(v); return !isNaN(+d) && d.toISOString().startsWith(v); }, "Огноо буруу байна.");
const taskInput = z.object({ title: z.string().trim().min(3, "Ажлын нэр дор хаяж 3 тэмдэгт байна.").max(180), description: z.string().trim().max(5000).default(""), assigneeId: z.string().min(1), platform: z.enum(["Facebook", "Instagram", "TikTok", "YouTube", "Бусад"]), priority: z.enum(["normal", "high"]), dueDate: date });
const createTaskInput = taskInput.extend({ assigneeId: z.string().min(1).optional() });
const messageInput = z.object({ message: z.string().trim().min(1, "Тайлбараа оруулна уу.").max(3000) });
const now = () => new Date().toISOString();
async function activity(taskId: string, userId: string, kind: string, message: string) { await db().prepare("INSERT INTO activities(id,taskId,userId,kind,message,createdAt) VALUES(?,?,?,?,?,?)").run(randomUUID(), taskId, userId, kind, message, now()); }
function originCheck(request: Request) {
  const origin = request.headers.get("origin");
  const expected = process.env.APP_ORIGIN || new URL(request.url).origin;
  if (!origin || origin !== expected) throw new AppError("Хүсэлтийн эх сурвалж зөвшөөрөгдөөгүй.", 403);
}
async function boundedBody(request: Request, max: number) {
  if (Number(request.headers.get("content-length") || 0) > max) throw new AppError("Илгээсэн өгөгдлийн хэмжээ хэтэрсэн.", 413);
  const reader = request.body?.getReader(); if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > max) { await reader.cancel(); throw new AppError("Илгээсэн өгөгдлийн хэмжээ хэтэрсэн.", 413); } chunks.push(value); }
  return Buffer.concat(chunks);
}
async function json(request: Request): Promise<unknown> { try { return JSON.parse(Buffer.from(await boundedBody(request, 32000)).toString("utf8")); } catch (error) { if (error instanceof AppError) throw error; throw new AppError("Хүсэлтийн өгөгдөл буруу байна."); } }
function ok(data: unknown = { ok: true }, status = 200) { return Response.json(data, { status, headers: { "Cache-Control": "no-store" } }); }
function failure(error: unknown) {
  if (error instanceof AppError) return ok({ error: error.message }, error.status);
  if (error instanceof z.ZodError) return ok({ error: error.issues[0]?.message || "Мэдээллээ шалгана уу." }, 400);
  if (error && typeof error === "object" && "code" in error && error.code === "23505") return ok({ error: "Энэ имэйлээр хэрэглэгч бүртгэлтэй байна." }, 409);
  log("error","api_error",{ error: error instanceof Error ? error.name : "UnknownError" }); return ok({ error: "Алдаа гарлаа. Дахин оролдоно уу." }, 500);
}

async function handleGET(request: Request, context: Context) {
  try {
    const segments = (await context.params).path;
    const user = await requireUser();
    if (segments[0] === "workspace") {
      const since = new URL(request.url).searchParams.get("since") || undefined;
      return ok(await workspace(user,since));
    }
    if (segments[0] === "tasks" && segments[1]) return ok(await taskDetail(segments[1],user));
    if (segments[0] === "tasks") return ok(await taskPage(user,new URL(request.url)));
    if (segments[0] === "audit") { requireAdmin(user); return ok(await auditPage(new URL(request.url))); }
    if (segments[0] === "files" && segments[1]) {
      const meta = await db().prepare("SELECT taskId FROM attachments WHERE id=?").get<{ taskId: string }>(segments[1]);
      if (!meta) throw new AppError("Зураг олдсонгүй.", 404);
      await accessibleTask(meta.taskId, user);
      const file = await db().prepare("SELECT storageKey,checksum,mime FROM attachments WHERE id=?").get<{ storageKey: string; checksum: string; mime: string }>(segments[1]);
      if (!file) throw new AppError("Зураг олдсонгүй.", 404);
      const data = readAttachment(file.storageKey,file.checksum);
      return new Response(new Uint8Array(data), { headers: { "Content-Type": file.mime, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" } });
    }
    if (segments[0] === "report") {
      const url = new URL(request.url); const from = url.searchParams.get("from") || "0000-01-01"; const to = url.searchParams.get("to") || "9999-12-31";
      const rows = (await workspace(user)).tasks.filter(t => t.dueDate >= from && t.dueDate <= to);
      const csv = "\ufeff" + [["Ажил", "Хариуцагч", "Суваг", "Дуусах огноо", "Төлөв", "Баталсан огноо"], ...rows.map(t => [t.title,t.assigneeName,t.platform,t.dueDate,STATUS_LABEL[t.status],t.approvedAt || ""])].map(row => row.map(csvCell).join(",")).join("\r\n");
      return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="achitpharma-report.csv"', "Cache-Control": "no-store" } });
    }
    throw new AppError("Хуудас олдсонгүй.", 404);
  } catch (error) { return failure(error); }
}

async function handlePOST(request: Request, context: Context) {
  try {
    originCheck(request);
    const [resource, id, action] = (await context.params).path;
    if (resource === "login") {
      const values = z.object({ email, password: z.string().min(1).max(128) }).parse(await json(request));
      let limits;
      try { limits = await recordLoginAttempt(values.email); } catch (error) { await audit("login_rate_limited",{ outcome: "blocked" }); throw error; }
      const user = await db().prepare("SELECT id,password,active FROM users WHERE email=?").get<{ id: string; password: string; active: number }>(values.email);
      // Equal-cost password work for unknown accounts.
      const matched = await verifyPassword(values.password, user?.password || `${"0".repeat(32)}:${"0".repeat(128)}`);
      if (!user || !user.active || !matched) { await audit("login_failed",{ actorId: user?.id, outcome: "failure" }); throw new AppError("Имэйл эсвэл нууц үг буруу байна.",401); }
      await clearSuccessfulLogin(limits);
      if (passwordNeedsRehash(user.password)) await db().prepare("UPDATE users SET password=? WHERE id=?").run(await hashPassword(values.password),user.id);
      await createSession(user.id); await audit("login_succeeded",{ actorId: user.id }); return ok();
    }
    const user = await requireUser();
    if (resource === "logout") { await audit("logout",{ actorId: user.id }); await logout(); return ok(); }
    if (resource === "logout-all") { await transaction(async () => { await db().prepare("DELETE FROM sessions WHERE userId=?").run(user.id); await audit("sessions_revoked",{ actorId: user.id, targetType: "user", targetId: user.id }); }); await logout(); return ok(); }
    if (resource === "password") {
      const values = z.object({ currentPassword: z.string().max(128), password }).parse(await json(request));
      const row = await db().prepare("SELECT password FROM users WHERE id=?").get<{ password: string }>(user.id);
      if (!row) throw new AppError("Хэрэглэгч олдсонгүй.", 404);
      if (!await verifyPassword(values.currentPassword, row.password)) throw new AppError("Одоогийн нууц үг буруу байна.");
      const hash = await hashPassword(values.password);
      await transaction(async () => { await db().prepare("UPDATE users SET password=? WHERE id=?").run(hash,user.id); await db().prepare("DELETE FROM sessions WHERE userId=?").run(user.id); await audit("password_changed",{ actorId: user.id, targetType: "user", targetId: user.id }); });
      await createSession(user.id); return ok();
    }
    if (resource === "users") {
      requireAdmin(user); const values = person.parse(await json(request)); const hash = await hashPassword(values.password);
      const employeeId = randomUUID(); await transaction(async () => { await db().prepare("INSERT INTO users(id,name,email,password,role,title,createdAt) VALUES(?,?,?,?,?,?,?)").run(employeeId,values.name,values.email,hash,"employee",values.title,now()); await audit("user_created",{ actorId: user.id, targetType: "user", targetId: employeeId }); }); return ok({},201);
    }
    if (resource === "tasks" && !id) {
      const values = createTaskInput.parse(await json(request));
      if (user.role !== "admin" && values.assigneeId && values.assigneeId !== user.id) throw new AppError("Зөвхөн өөрийн төлөвлөгөөг үүсгэх боломжтой.", 403);
      const assigneeId = user.role === "admin" ? values.assigneeId : user.id;
      if (!assigneeId || !await db().prepare("SELECT id FROM users WHERE id=? AND active=1").get(assigneeId)) throw new AppError("Идэвхтэй ажилтан сонгоно уу.");
      const taskId = randomUUID(); const timestamp = now();
      await transaction(async () => { await db().prepare("INSERT INTO tasks(id,title,description,assigneeId,platform,priority,dueDate,status,createdBy,createdAt,updatedAt) VALUES(?,?,?,?,?,?,?,'planned',?,?,?)").run(taskId,values.title,values.description,assigneeId,values.platform,values.priority,values.dueDate,user.id,timestamp,timestamp); await activity(taskId,user.id,"created",user.role === "admin" ? "Ажил үүсгэж хуваариллаа." : "Өөрийн ажлын төлөвлөгөөг үүсгэлээ."); await audit("task_created",{ actorId: user.id, targetType: "task", targetId: taskId, metadata: { assigneeId } }); }); return ok({ id: taskId },201);
    }
    if (resource === "tasks" && id) {
      const task = await accessibleTask(id,user);
      if (action === "comments") { const values = messageInput.parse(await json(request)); await transaction(async () => { await activity(id,user.id,"comment",values.message); await audit("task_commented",{ actorId: user.id, targetType: "task", targetId: id }); }); return ok(); }
      if (action === "start") {
        if (user.id !== task.assigneeId) throw new AppError("Зөвхөн хариуцсан ажилтан эхлүүлнэ.",403);
        await transaction(async () => {
          const result = await db().prepare("UPDATE tasks SET status='in_progress',updatedAt=? WHERE id=? AND status IN ('planned','revision')").run(now(),id);
          if (!result.changes) throw new AppError("Ажлын төлөв өөрчлөгдсөн байна.",409);
          await activity(id,user.id,"started","Ажлаа эхлүүллээ.");
          await audit("task_started",{ actorId: user.id, targetType: "task", targetId: id });
        }); return ok();
      }
      if (action === "submit") {
        if (user.id !== task.assigneeId) throw new AppError("Зөвхөн хариуцсан ажилтан гүйцэтгэл илгээнэ.",403);
        if (!["planned","in_progress","revision"].includes(task.status)) throw new AppError("Энэ төлөвт гүйцэтгэл илгээх боломжгүй.",409);
        const bytes = await boundedBody(request, 26 * 1024 * 1024);
        const form = await new Response(new Uint8Array(bytes), { headers: { "Content-Type": request.headers.get("content-type") || "" } }).formData();
        const note = z.string().trim().max(3000).parse(form.get("note") || "");
        const files = form.getAll("files").filter((v): v is File => v instanceof File && v.size > 0);
        if (!files.length || files.length > 5) throw new AppError("1–5 screenshot хавсаргана уу.");
        const validated = await Promise.all(files.map(async file => {
          if (file.size > 5 * 1024 * 1024) throw new AppError("Нэг зураг 5 MB-аас бага байна.");
          const data = Buffer.from(await file.arrayBuffer()); const mime = imageMime(data);
          if (!mime || mime !== file.type) throw new AppError("Зөвхөн PNG, JPG, WebP зураг оруулна уу.");
          return { data, mime, name: file.name.slice(0,180), size: file.size };
        }));
        const stored = validated.map(file => { const attachmentId = randomUUID(); return { ...file, attachmentId, stored: storeAttachment(attachmentId,file.data) }; });
        try {
          await transaction(async () => {
            const updated = await db().prepare("UPDATE tasks SET status='submitted',updatedAt=? WHERE id=? AND assigneeId=? AND status IN ('planned','in_progress','revision')").run(now(),id,user.id);
            if (!updated.changes) throw new AppError("Ажлын төлөв өөрчлөгдсөн. Дахин ачаална уу.",409);
            const submissionId = randomUUID();
            await db().prepare("INSERT INTO submissions(id,taskId,userId,note,createdAt) VALUES(?,?,?,?,?)").run(submissionId,id,user.id,note,now());
            for (const file of stored) await db().prepare("INSERT INTO attachments(id,taskId,submissionId,name,mime,size,storageKey,checksum,createdAt) VALUES(?,?,?,?,?,?,?,?,?)").run(file.attachmentId,id,submissionId,file.name,file.mime,file.size,file.stored.key,file.stored.checksum,now());
            await activity(id,user.id,"submitted",`Гүйцэтгэл илгээлээ. ${note}`.trim());
            await audit("task_submitted",{ actorId: user.id, targetType: "task", targetId: id, metadata: { fileCount: stored.length } });
          });
        } catch (error) {
          for (const file of stored) if (file.stored.created) removeAttachment(file.stored.key);
          throw error;
        }
        return ok();
      }
      if (action === "review") {
        requireAdmin(user);
        const values = z.object({ decision: z.enum(["approved","revision"]), message: z.string().trim().max(3000).default("") }).parse(await json(request));
        if (values.decision === "revision" && !values.message) throw new AppError("Засах зүйлсийг тайлбарлана уу.");
        await transaction(async () => {
          const result = await db().prepare("UPDATE tasks SET status=?,updatedAt=?,approvedAt=? WHERE id=? AND status='submitted'").run(values.decision,now(),values.decision === "approved" ? now() : null,id);
          if (!result.changes) throw new AppError("Хянуулахаар илгээсэн ажлыг сонгоно уу.",409);
          await activity(id,user.id,values.decision,`${values.decision === "approved" ? "Гүйцэтгэлийг баталлаа." : "Засварт буцаалаа."} ${values.message}`.trim());
          await audit("task_reviewed",{ actorId: user.id, targetType: "task", targetId: id, metadata: { decision: values.decision } });
        }); return ok();
      }
    }
    throw new AppError("Хүсэлт олдсонгүй.",404);
  } catch (error) { return failure(error); }
}

async function handlePATCH(request: Request, context: Context) {
  try {
    originCheck(request); const user = await requireUser(); requireAdmin(user);
    const [resource,id] = (await context.params).path;
    if (resource === "users" && id) {
      const existing = await db().prepare("SELECT id,role FROM users WHERE id=?").get<User>(id);
      if (!existing) throw new AppError("Ажилтан олдсонгүй.",404);
      const values = z.object({ name: z.string().trim().min(2).max(100), email, title: z.string().trim().max(100), active: z.boolean(), password: password.optional() }).parse(await json(request));
      if (id === user.id && !values.active) throw new AppError("Өөрийн эрхийг хаах боломжгүй.");
      if (existing.role === "admin" && !values.active) throw new AppError("Админы эрхийг энэ дэлгэцээс хаах боломжгүй.");
      const hash = values.password ? await hashPassword(values.password) : null;
      await transaction(async () => {
        await db().prepare("UPDATE users SET name=?,email=?,title=?,active=? WHERE id=?").run(values.name,values.email,values.title,values.active ? 1 : 0,id);
        if (hash) await db().prepare("UPDATE users SET password=? WHERE id=?").run(hash,id);
        if (hash || !values.active) await db().prepare("DELETE FROM sessions WHERE userId=?").run(id);
        await audit("user_updated",{ actorId: user.id, targetType: "user", targetId: id, metadata: { active: values.active, passwordChanged: !!hash } });
      }); return ok();
    }
    if (resource === "tasks" && id) {
      await accessibleTask(id,user); const values = taskInput.parse(await json(request));
      if (!await db().prepare("SELECT id FROM users WHERE id=? AND active=1").get(values.assigneeId)) throw new AppError("Идэвхтэй ажилтан сонгоно уу.");
      await transaction(async () => {
        const result = await db().prepare("UPDATE tasks SET title=?,description=?,assigneeId=?,platform=?,priority=?,dueDate=?,updatedAt=? WHERE id=? AND status IN ('planned','in_progress','revision')").run(values.title,values.description,values.assigneeId,values.platform,values.priority,values.dueDate,now(),id);
        if (!result.changes) throw new AppError("Хянуулж байгаа эсвэл батлагдсан ажлыг засах боломжгүй.",409);
        await activity(id,user.id,"edited","Ажлын төлөвлөгөөг шинэчиллээ.");
        await audit("task_updated",{ actorId: user.id, targetType: "task", targetId: id });
      }); return ok();
    }
    throw new AppError("Хүсэлт олдсонгүй.",404);
  } catch (error) { return failure(error); }
}

export function GET(request: Request, context: Context) {
  return withRequestContext(request, () => handleGET(request,context));
}

export function POST(request: Request, context: Context) {
  return withRequestContext(request, () => handlePOST(request,context));
}

export function PATCH(request: Request, context: Context) {
  return withRequestContext(request, () => handlePATCH(request,context));
}

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db, transaction } from "./db";
import { AppError, hashPassword } from "./security";

// Local provisioning only. Never expose this function through an HTTP handler.
export async function hasAdmin() {
  return !!await db().prepare("SELECT id FROM users WHERE role='admin' LIMIT 1").get();
}

export async function provisionAdmin(input: unknown) {
  const values = z.object({
    name: z.string().trim().min(2, "Нэрээ оруулна уу.").max(100),
    email: z.string().trim().toLowerCase().email("Зөв имэйл хаяг оруулна уу.").max(254),
    password: z.string().min(10, "Нууц үг 10-аас доошгүй тэмдэгттэй байна.").max(128),
  }).parse(input);
  const hash = await hashPassword(values.password);
  const id = randomUUID();
  await transaction(async () => {
    if (await hasAdmin()) throw new AppError("Админ эрх өмнө нь үүссэн байна. Одоо байгаа эрхийг өөрчлөхгүй.", 409);
    await db().prepare("INSERT INTO users(id,name,email,password,role,title,createdAt) VALUES(?,?,?,?,?,?,?)")
      .run(id, values.name, values.email, hash, "admin", "Багийн админ", new Date().toISOString());
  });
  return { id, name: values.name, email: values.email };
}

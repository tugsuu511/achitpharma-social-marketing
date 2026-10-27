import { existsSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { z } from "zod";
import { hasAdmin, provisionAdmin } from "../src/lib/admin";

async function main() {
  for (const filename of [".env.local", ".env"]) {
    if (existsSync(filename)) process.loadEnvFile(filename);
  }
  if (await hasAdmin()) throw new Error("Админ эрх өмнө нь үүссэн байна. Одоо байгаа эрхийг өөрчлөхгүй.");
  let input: unknown;
  if (process.argv.includes("--stdin-json")) {
    // Automation supplies credentials via stdin, never process arguments or files.
    let body = "";
    for await (const chunk of process.stdin) {
      body += chunk.toString();
      if (body.length > 4096) throw new Error("Оролтын хэмжээ хэтэрсэн.");
    }
    try { input = JSON.parse(body); } catch { throw new Error("Оролтын JSON буруу байна."); }
  } else {
    if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error("Интерактив терминалаас npm.cmd run admin:create командыг ажиллуулна уу.");
    let hidden = false;
    const output = new Writable({ write(chunk, _encoding, callback) { if (!hidden) process.stdout.write(chunk); callback(); } });
    const terminal = createInterface({ input: process.stdin, output, terminal: true });
    terminal.on("SIGINT", () => { terminal.close(); process.exit(130); });
    try {
      const name = await terminal.question("Админы нэр: ");
      const email = await terminal.question("Имэйл хаяг: ");
      process.stdout.write("Нууц үг (бичихэд харагдахгүй): ");
      hidden = true;
      const password = await terminal.question("");
      process.stdout.write("\nНууц үг давтах: ");
      const confirmation = await terminal.question("");
      hidden = false;
      process.stdout.write("\n");
      if (password !== confirmation) throw new Error("Нууц үг давталттайгаа таарахгүй байна.");
      input = { name, email, password };
    } finally { terminal.close(); }
  }
  await provisionAdmin(input);
  console.log("Админ эрх үүслээ. Вебийн нэвтрэх дэлгэцээр орно уу.");
}

main().catch(error => {
  // Never print input or the full validation error, which could contain credentials.
  console.error(error instanceof z.ZodError ? error.issues[0]?.message : "Админ эрх үүсгэсэнгүй. " + (error instanceof Error && !error.message.includes("constraint") ? error.message : "Мэдээллээ шалгана уу."));
  process.exitCode = 1;
});

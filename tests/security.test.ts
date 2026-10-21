import test from "node:test";
import assert from "node:assert/strict";
import { csvCell, hashPassword, imageMime, verifyPassword } from "../src/lib/security";
import { isOverdue, todayInMongolia, type Task } from "../src/lib/types";

test("passwords use unique salts and reject incorrect passwords", async () => {
  const one = await hashPassword("Long-test-password!");
  const two = await hashPassword("Long-test-password!");
  assert.notEqual(one,two);
  assert.equal(await verifyPassword("Long-test-password!",one),true);
  assert.equal(await verifyPassword("wrong-password",one),false);
  assert.equal(await verifyPassword("Long-test-password!","bad-hash"),false);
});
test("screenshot validation reads file signatures, not extensions", () => {
  assert.equal(imageMime(Buffer.from("<svg><script>alert(1)</script></svg>")),null);
  assert.equal(imageMime(Buffer.from("not actually an image.png")),null);
  assert.equal(imageMime(Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0])),"image/png");
  assert.equal(imageMime(Buffer.from([255,216,255,224,0,0,0,0,0,0,0,0])),"image/jpeg");
  assert.equal(imageMime(Buffer.from("RIFF0000WEBP")),"image/webp");
});
test("CSV values cannot execute spreadsheet formulas", () => {
  assert.equal(csvCell('=HYPERLINK("x")'),'"\'=HYPERLINK(""x"")"');
  assert.equal(csvCell("+SUM(1,2)"),'"\'+SUM(1,2)"');
  assert.equal(csvCell("Энгийн, утга"),'"Энгийн, утга"');
});
test("approved tasks are not overdue and due dates are inclusive", () => {
  assert.equal(isOverdue({ dueDate: "2026-10-20",status: "approved" } as Task,"2026-10-21"),false);
  assert.equal(isOverdue({ dueDate: "2026-10-21",status: "planned" } as Task,"2026-10-21"),false);
  assert.equal(isOverdue({ dueDate: "2026-10-20",status: "in_progress" } as Task,"2026-10-21"),true);
  assert.match(todayInMongolia(),/^\d{4}-\d{2}-\d{2}$/);
});

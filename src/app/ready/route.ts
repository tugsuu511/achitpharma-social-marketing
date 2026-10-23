import { db } from "@/lib/db";
import { migrationStatus } from "@/lib/migrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  try {
    const connection = db();
    connection.prepare("SELECT 1").get();
    const schema = migrationStatus(connection);
    if (schema.current !== schema.latest) throw new Error("Database schema is not current.");
    return Response.json({ status: "ready" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error(JSON.stringify({ timestamp: new Date().toISOString(), level: "error", event: "readiness_failed", error: error instanceof Error ? error.name : "UnknownError" }));
    return Response.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";

type RequestContext = { requestId: string; ipHash: string; startedAt: number };
const storage = new AsyncLocalStorage<RequestContext>();
const developmentSecret = randomBytes(32).toString("hex");

function clientIp(request: Request) {
  if (process.env.TRUST_PROXY === "true") return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "unknown";
  return "untrusted-proxy-disabled";
}

function hashIp(ip: string) {
  return createHmac("sha256", process.env.IP_HASH_SECRET || developmentSecret).update(ip).digest("hex");
}

function requestId(request: Request) {
  const supplied = request.headers.get("x-request-id");
  return supplied && /^[A-Za-z0-9_-]{8,100}$/.test(supplied) ? supplied : randomUUID();
}

export function context() {
  return storage.getStore() ?? { requestId: "system", ipHash: "", startedAt: Date.now() };
}

export function log(level: "info" | "warn" | "error", event: string, fields: Record<string, unknown> = {}) {
  const current = context();
  const entry = JSON.stringify({ timestamp: new Date().toISOString(), level, event, requestId: current.requestId, ...fields });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.info(entry);
}

export async function withRequestContext(request: Request, handler: () => Promise<Response>) {
  const state = { requestId: requestId(request), ipHash: hashIp(clientIp(request)), startedAt: Date.now() };
  return storage.run(state, async () => {
    try {
      const response = await handler();
      response.headers.set("X-Request-Id", state.requestId);
      log(response.status >= 500 ? "error" : response.status >= 400 ? "warn" : "info", "http_request", { method: request.method, path: new URL(request.url).pathname, status: response.status, durationMs: Date.now() - state.startedAt });
      return response;
    } catch (error) {
      log("error", "unhandled_request_error", { method: request.method, path: new URL(request.url).pathname, durationMs: Date.now() - state.startedAt, error: error instanceof Error ? error.name : "UnknownError" });
      throw error;
    }
  });
}

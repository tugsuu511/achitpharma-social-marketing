import { AsyncLocalStorage } from "node:async_hooks";
import { Pool, types, type PoolClient, type QueryResultRow } from "pg";
import { applicationDatabaseUrl } from "./postgres-url";

types.setTypeParser(20, value => Number(value));

type RunResult = { changes: number };
type Executor = Pick<Pool, "query"> | Pick<PoolClient, "query">;

const CAMEL_IDENTIFIERS = [
  "appliedAt", "userId", "resetAt", "createdAt", "lastSeenAt", "assigneeId",
  "dueDate", "createdBy", "updatedAt", "approvedAt", "taskId", "submissionId",
  "storageKey", "requestId", "actorId", "targetType", "targetId", "ipHash",
  "assigneeName", "attachmentCount", "actorName",
];

function postgresSql(sql: string) {
  let parameter = 0;
  let result = sql.replace(/\?/g, () => `$${++parameter}`);
  for (const identifier of CAMEL_IDENTIFIERS) {
    result = result.replace(new RegExp(`(?<!["A-Za-z0-9_])${identifier}(?!["A-Za-z0-9_])`, "g"), `"${identifier}"`);
  }
  return result;
}

const globalState = globalThis as unknown as { achitPool?: Pool };
const transactionClient = new AsyncLocalStorage<PoolClient>();

export function pool() {
  if (!globalState.achitPool) {
    globalState.achitPool = new Pool({
      connectionString: applicationDatabaseUrl(),
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
    globalState.achitPool.on("error", error => console.error(JSON.stringify({ timestamp: new Date().toISOString(), level: "error", event: "postgres_pool_error", error: error.name })));
  }
  return globalState.achitPool;
}

function executor(): Executor {
  return transactionClient.getStore() ?? pool();
}

class Statement {
  constructor(private readonly sql: string) {}

  async get<T extends QueryResultRow = QueryResultRow>(...parameters: unknown[]): Promise<T | undefined> {
    const result = await executor().query<T>(postgresSql(this.sql), parameters);
    return result.rows[0];
  }

  async all<T extends QueryResultRow = QueryResultRow>(...parameters: unknown[]): Promise<T[]> {
    const result = await executor().query<T>(postgresSql(this.sql), parameters);
    return result.rows;
  }

  async run(...parameters: unknown[]): Promise<RunResult> {
    const result = await executor().query(postgresSql(this.sql), parameters);
    return { changes: result.rowCount ?? 0 };
  }
}

const database = { prepare: (sql: string) => new Statement(sql) };

export function db() {
  return database;
}

export async function transaction<T>(fn: () => Promise<T>): Promise<T> {
  if (transactionClient.getStore()) return fn();
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const result = await transactionClient.run(client, fn);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function closeDatabase() {
  const current = globalState.achitPool;
  if (!current) return;
  globalState.achitPool = undefined;
  await current.end();
}

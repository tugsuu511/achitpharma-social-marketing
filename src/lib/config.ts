import path from "node:path";

export type ProductionEnvironment = {
  appOrigin: string;
  dataDirectory: string;
  secureCookies: boolean;
  insecureLocalOrigin: boolean;
};

function isLoopback(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function isInside(parent: string, child: string) {
  const relative = path.relative(parent,child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function validateProductionEnvironment(env: Readonly<Record<string, string | undefined>> = process.env): ProductionEnvironment {
  const errors: string[] = [];
  const appOrigin = env.APP_ORIGIN?.trim() || "";
  let origin: URL | undefined;
  try {
    origin = new URL(appOrigin);
  } catch {
    errors.push("APP_ORIGIN must be a valid absolute URL.");
  }

  if (origin && appOrigin !== origin.origin) errors.push("APP_ORIGIN must contain only the public origin, without a path or trailing slash.");
  const insecureLocalOrigin = env.ALLOW_INSECURE_LOCAL_ORIGIN === "true" && !!origin && isLoopback(origin.hostname) && origin.protocol === "http:";
  if (origin && origin.protocol !== "https:" && !insecureLocalOrigin) errors.push("APP_ORIGIN must use HTTPS in production.");
  if (env.COOKIE_SECURE !== "true" && !insecureLocalOrigin) errors.push("COOKIE_SECURE must be true in production.");

  const dataDirectory = env.DATA_DIR?.trim() || "";
  if (!dataDirectory) errors.push("DATA_DIR is required in production.");
  else if (!path.isAbsolute(dataDirectory)) errors.push("DATA_DIR must be an absolute path in production.");
  else if (isInside(path.resolve(process.cwd(),"public"),path.resolve(dataDirectory))) errors.push("DATA_DIR must not be inside public/.");
  if (env.TRUST_PROXY !== "true") errors.push("TRUST_PROXY must be true when production is served behind the required reverse proxy.");
  if (!env.IP_HASH_SECRET || env.IP_HASH_SECRET.length < 32) errors.push("IP_HASH_SECRET must contain at least 32 characters.");
  const privateFiles = env.PRIVATE_FILES_DIR?.trim();
  if (privateFiles && !path.isAbsolute(privateFiles)) errors.push("PRIVATE_FILES_DIR must be an absolute path when set.");
  else if (privateFiles && isInside(path.resolve(process.cwd(),"public"),path.resolve(privateFiles))) errors.push("PRIVATE_FILES_DIR must not be inside public/.");

  if (errors.length) throw new Error(`Production environment is invalid:\n- ${errors.join("\n- ")}`);
  return { appOrigin: origin!.origin, dataDirectory: path.resolve(dataDirectory), secureCookies: env.COOKIE_SECURE === "true", insecureLocalOrigin };
}

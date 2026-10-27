function verifiedUrl(value: string) {
  const url = new URL(value);
  const sslMode = url.searchParams.get("sslmode");
  if (sslMode === "prefer" || sslMode === "require" || sslMode === "verify-ca") url.searchParams.set("sslmode", "verify-full");
  return url.toString();
}

export function applicationDatabaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error("DATABASE_URL is required. Run `neon deploy` to pull the Neon environment.");
  return verifiedUrl(value);
}

export function migrationDatabaseUrl() {
  const value = process.env.DATABASE_URL_UNPOOLED?.trim() || process.env.DATABASE_URL?.trim();
  if (!value) throw new Error("DATABASE_URL_UNPOOLED or DATABASE_URL is required.");
  return verifiedUrl(value);
}

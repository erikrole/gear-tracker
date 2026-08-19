const MIGRATION_URL_KEYS = ["DIRECT_URL", "DATABASE_URL_UNPOOLED"];
const VERCEL_REDACTED_VALUE = "[SENSITIVE]";

export const PRISMA_SCHEMA_PLACEHOLDER_URL =
  "postgresql://placeholder:placeholder@localhost:5432/placeholder";

export function resolvePrismaDirectUrl(environment = process.env, options = {}) {
  const required = options.required ?? true;
  const maskedKeys = [];

  for (const key of MIGRATION_URL_KEYS) {
    const value = environment[key]?.trim();
    if (!value) continue;
    if (isMaskedVercelValue(value)) {
      maskedKeys.push(key);
      continue;
    }

    validateDirectPostgresUrl(value, key);
    return { connectionString: value, source: key };
  }

  if (!required) return null;

  if (maskedKeys.length > 0) {
    throw new Error(
      `Vercel redacted ${maskedKeys.join(" and ")} as ${VERCEL_REDACTED_VALUE}. ` +
        "Sensitive Production/Preview values cannot be downloaded for local migration commands. " +
        "Run the command inside the target Vercel build, provide a direct Neon URL explicitly in the local shell, " +
        "or use the authenticated Neon operator path. DATABASE_URL is intentionally ignored because it may be pooled.",
    );
  }

  throw new Error(
    "Missing a direct Prisma migration connection. Set DIRECT_URL or DATABASE_URL_UNPOOLED. " +
      "DATABASE_URL is intentionally ignored because it may be pooled.",
  );
}

export function resolvePrismaConfigUrl(environment = process.env) {
  return (
    resolvePrismaDirectUrl(environment, { required: false })?.connectionString ??
    PRISMA_SCHEMA_PLACEHOLDER_URL
  );
}

export function isMaskedVercelValue(value) {
  return value.trim() === VERCEL_REDACTED_VALUE;
}

function validateDirectPostgresUrl(value, source) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${source} must be a valid PostgreSQL URL.`);
  }

  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error(`${source} must use the postgres:// or postgresql:// protocol.`);
  }

  if (parsed.hostname.includes("-pooler")) {
    throw new Error(
      `${source} points to a pooled Neon host. Migration DDL requires DIRECT_URL or DATABASE_URL_UNPOOLED.`,
    );
  }
}

type SmokeEnvironment = Readonly<Record<string, string | undefined>>;

export type SmokeRole = "STUDENT" | "STAFF" | "ADMIN";

const DEFAULT_BASE_URL = "http://127.0.0.1:3000";
const KNOWN_PRODUCTION_HOSTS = new Set([
  "wisconsincreative.com",
  "www.wisconsincreative.com",
  "gear.erikrole.com",
]);

function normalizeConfiguredHost(value: string) {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return null;
  try {
    return new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`).hostname;
  } catch {
    throw new Error(`Invalid PLAYWRIGHT_PRODUCTION_HOSTS entry: ${trimmed}`);
  }
}

export function resolveSmokeSafety(env: SmokeEnvironment = process.env) {
  const email = env.PLAYWRIGHT_EMAIL?.trim();
  const password = env.PLAYWRIGHT_PASSWORD;
  const roleValue = env.PLAYWRIGHT_ROLE?.trim().toUpperCase();
  const role: SmokeRole | undefined =
    roleValue === "STUDENT" || roleValue === "STAFF" || roleValue === "ADMIN"
      ? roleValue
      : undefined;
  const hasAnyCredentialInput = Boolean(email || password || roleValue);
  const hasCredentials = Boolean(email && password && role);
  const strictMode = env.PLAYWRIGHT_RELEASE === "1" || env.CI !== undefined;

  if (hasAnyCredentialInput && !hasCredentials) {
    throw new Error(
      "Authenticated Playwright smoke requires complete PLAYWRIGHT_EMAIL, PLAYWRIGHT_PASSWORD, and PLAYWRIGHT_ROLE values (STUDENT, STAFF, or ADMIN).",
    );
  }

  if (strictMode && !hasCredentials) {
    throw new Error(
      "CI and release Playwright smoke require PLAYWRIGHT_EMAIL, PLAYWRIGHT_PASSWORD, and PLAYWRIGHT_ROLE (STUDENT, STAFF, or ADMIN).",
    );
  }

  if (strictMode && role === "ADMIN") {
    throw new Error(
      "CI and release Playwright smoke require a STUDENT or STAFF test identity so the direct role-restricted Settings check can run.",
    );
  }

  const baseURLValue = env.PLAYWRIGHT_BASE_URL ?? DEFAULT_BASE_URL;
  let baseURL: URL;
  try {
    baseURL = new URL(baseURLValue);
  } catch {
    throw new Error(`PLAYWRIGHT_BASE_URL is not a valid URL: ${baseURLValue}`);
  }

  const productionHosts = new Set(KNOWN_PRODUCTION_HOSTS);
  for (const entry of env.PLAYWRIGHT_PRODUCTION_HOSTS?.split(",") ?? []) {
    const hostname = normalizeConfiguredHost(entry);
    if (hostname) productionHosts.add(hostname);
  }

  if (hasCredentials && env.PLAYWRIGHT_TARGET_ISOLATED !== "1") {
    throw new Error(
      "Authenticated Playwright smoke requires PLAYWRIGHT_TARGET_ISOLATED=1 to confirm the target uses isolated test data.",
    );
  }

  if (hasCredentials && productionHosts.has(baseURL.hostname.toLowerCase())) {
    throw new Error(
      `Authenticated Playwright smoke refuses production host ${baseURL.hostname}. Use an isolated local or review target.`,
    );
  }

  return {
    baseURL: baseURL.origin,
    hasCredentials,
    releaseMode: env.PLAYWRIGHT_RELEASE === "1",
    role,
    strictMode,
  };
}

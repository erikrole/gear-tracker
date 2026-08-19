export const PRISMA_SCHEMA_PLACEHOLDER_URL: string;

export function resolvePrismaDirectUrl(
  environment?: Record<string, string | undefined>,
  options?: { required?: boolean },
): { connectionString: string; source: "DIRECT_URL" | "DATABASE_URL_UNPOOLED" } | null;

export function resolvePrismaConfigUrl(
  environment?: Record<string, string | undefined>,
): string;

export function isMaskedVercelValue(value: string): boolean;

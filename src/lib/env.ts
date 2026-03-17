function getRequired(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  get databaseUrl() {
    return getRequired("DATABASE_URL");
  },
  get sessionSecret() {
    return getRequired("SESSION_SECRET");
  },
  get sessionCookieName() {
    return getRequired("SESSION_COOKIE_NAME");
  },
  get appTimezone() {
    return process.env.APP_TIMEZONE || "America/Chicago";
  },
  /** Optional — enables Vercel Cron auth for /api/cron/* routes */
  get cronSecret() {
    return process.env.CRON_SECRET || "";
  },
  /** Optional — enables email delivery via Resend. Falls back to console.log */
  get resendApiKey() {
    return process.env.RESEND_API_KEY || "";
  },
  /** From address for transactional email */
  get emailFrom() {
    return process.env.EMAIL_FROM || "Gear Tracker <noreply@gear-tracker.app>";
  },
  /** Base URL for the app (used in emails). Falls back to VERCEL_URL or localhost. */
  get appUrl() {
    return process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  },
  /** Optional — enables Sentry error tracking */
  get sentryDsn() {
    return process.env.SENTRY_DSN || "";
  },
  /** Optional — enables Vercel Blob image uploads */
  get blobReadWriteToken() {
    return process.env.BLOB_READ_WRITE_TOKEN || "";
  },
};

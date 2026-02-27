const required = ["DATABASE_URL", "SESSION_SECRET", "SESSION_COOKIE_NAME"] as const;

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const env = {
  databaseUrl: process.env.DATABASE_URL as string,
  sessionSecret: process.env.SESSION_SECRET as string,
  sessionCookieName: process.env.SESSION_COOKIE_NAME as string,
  appTimezone: process.env.APP_TIMEZONE || "America/Chicago"
};

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
  }
};

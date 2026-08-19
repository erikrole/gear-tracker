import { describe, expect, it } from "vitest";

import {
  PRISMA_SCHEMA_PLACEHOLDER_URL,
  isMaskedVercelValue,
  resolvePrismaConfigUrl,
  resolvePrismaDirectUrl,
} from "../scripts/lib/prisma-direct-url.mjs";

describe("Prisma direct migration connection", () => {
  const direct =
    "postgresql://user:password@ep-example.us-east-1.aws.neon.tech/gear-tracker?sslmode=require";
  const unpooled =
    "postgresql://user:password@ep-other.us-east-1.aws.neon.tech/gear-tracker?sslmode=require";

  it("prefers an explicit DIRECT_URL", () => {
    expect(
      resolvePrismaDirectUrl({ DIRECT_URL: direct, DATABASE_URL_UNPOOLED: unpooled }),
    ).toEqual({ connectionString: direct, source: "DIRECT_URL" });
  });

  it("uses the Neon integration's unpooled URL when DIRECT_URL is absent", () => {
    expect(resolvePrismaDirectUrl({ DATABASE_URL_UNPOOLED: unpooled })).toEqual({
      connectionString: unpooled,
      source: "DATABASE_URL_UNPOOLED",
    });
  });

  it("skips a masked DIRECT_URL when an executable unpooled URL exists", () => {
    expect(
      resolvePrismaDirectUrl({
        DIRECT_URL: '"[SENSITIVE]"'.slice(1, -1),
        DATABASE_URL_UNPOOLED: unpooled,
      }),
    ).toEqual({ connectionString: unpooled, source: "DATABASE_URL_UNPOOLED" });
  });

  it("explains why Vercel sensitive values cannot run locally", () => {
    expect(() =>
      resolvePrismaDirectUrl({
        DIRECT_URL: "[SENSITIVE]",
        DATABASE_URL_UNPOOLED: "[SENSITIVE]",
      }),
    ).toThrow(/Sensitive Production\/Preview values cannot be downloaded/);
    expect(isMaskedVercelValue(" [SENSITIVE] ")).toBe(true);
  });

  it("never falls back to the pooled runtime DATABASE_URL", () => {
    expect(() =>
      resolvePrismaDirectUrl({
        DATABASE_URL:
          "postgresql://user:password@ep-example-pooler.us-east-1.aws.neon.tech/gear-tracker",
      }),
    ).toThrow(/DATABASE_URL is intentionally ignored/);
  });

  it("rejects a pooled URL even when it is mislabeled as direct", () => {
    expect(() =>
      resolvePrismaDirectUrl({
        DIRECT_URL:
          "postgresql://user:password@ep-example-pooler.us-east-1.aws.neon.tech/gear-tracker",
      }),
    ).toThrow(/points to a pooled Neon host/);
  });

  it("uses an inert placeholder only for Prisma schema configuration", () => {
    expect(resolvePrismaConfigUrl({})).toBe(PRISMA_SCHEMA_PLACEHOLDER_URL);
    expect(resolvePrismaDirectUrl({}, { required: false })).toBeNull();
  });
});

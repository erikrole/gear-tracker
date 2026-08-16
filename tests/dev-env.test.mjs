import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";
import {
  ensureDevelopmentSessionSecret,
  isValidSessionSecret,
  readDotenvValue,
} from "../scripts/ensure-dev-env.mjs";
import { assertNextBuildSafe } from "../scripts/guard-next-build.mjs";
import { buildPreviewDevEnvironment } from "../scripts/start-preview-dev.mjs";

const temporaryRoots = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function createTemporaryRoot() {
  const root = mkdtempSync(join(tmpdir(), "gear-tracker-dev-env-"));
  temporaryRoots.push(root);
  return root;
}

describe("development environment bootstrap", () => {
  it("BUG: creates a development override when the Vercel local secret is too short", () => {
    const root = createTemporaryRoot();
    writeFileSync(join(root, ".env.local"), 'SESSION_SECRET="short"\n');

    const result = ensureDevelopmentSessionSecret({
      rootDir: root,
      environment: {},
      randomSecret: () => "a".repeat(64),
    });

    expect(result.status).toBe("generated");
    expect(
      readDotenvValue(readFileSync(join(root, ".env.development.local"), "utf8"), "SESSION_SECRET"),
    ).toBe("a".repeat(64));
    expect(readFileSync(join(root, ".env.local"), "utf8")).toContain('SESSION_SECRET="short"');
  });

  it("preserves a valid local secret instead of creating an override", () => {
    const root = createTemporaryRoot();
    const secret = "b".repeat(32);
    writeFileSync(join(root, ".env.local"), `SESSION_SECRET="${secret}"\n`);

    const result = ensureDevelopmentSessionSecret({ rootDir: root, environment: {} });

    expect(result.status).toBe("local-file");
    expect(isValidSessionSecret(secret)).toBe(true);
  });

  it("fails clearly when an explicit shell secret is invalid", () => {
    expect(() =>
      ensureDevelopmentSessionSecret({
        rootDir: createTemporaryRoot(),
        environment: { SESSION_SECRET: "short" },
      }),
    ).toThrow("SESSION_SECRET must be at least 32 characters");
  });

  it("does not generate development credentials in production", () => {
    const root = createTemporaryRoot();

    const result = ensureDevelopmentSessionSecret({
      rootDir: root,
      environment: { NODE_ENV: "production" },
    });

    expect(result).toEqual({ status: "skipped", reason: "production" });
  });

  it("BUG: refuses a Next build while the dev port is active", async () => {
    await expect(
      assertNextBuildSafe({
        host: "127.0.0.1",
        port: 3000,
        isPortOpen: async () => true,
      }),
    ).rejects.toThrow("next dev and next build share .next");

    await expect(
      assertNextBuildSafe({
        host: "127.0.0.1",
        port: 3000,
        isPortOpen: async () => false,
      }),
    ).resolves.toEqual({ status: "clear", host: "127.0.0.1", port: 3000 });
  });

  it("BUG: keeps Preview storage variables while replacing a short provider session secret", () => {
    const developmentSecret = "c".repeat(32);
    const environment = buildPreviewDevEnvironment({
      baseEnvironment: {
        SESSION_SECRET: "short",
        SIGNATURE_BLOB_READ_WRITE_TOKEN: "private-preview-token",
      },
      developmentSecret,
    });

    expect(environment.SESSION_SECRET).toBe(developmentSecret);
    expect(environment.SIGNATURE_BLOB_READ_WRITE_TOKEN).toBe("private-preview-token");
    expect(environment.NODE_ENV).toBe("development");
  });
});

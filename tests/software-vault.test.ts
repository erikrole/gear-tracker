import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { decryptSoftwareSecret, encryptSoftwareSecret } from "../src/lib/software-vault-crypto";

const originalVaultKey = process.env.SOFTWARE_VAULT_KEY;

function source(path: string) {
  return readFileSync(path, "utf8");
}

beforeEach(() => {
  process.env.SOFTWARE_VAULT_KEY = Buffer.alloc(32, 7).toString("base64");
});

afterAll(() => {
  if (originalVaultKey === undefined) delete process.env.SOFTWARE_VAULT_KEY;
  else process.env.SOFTWARE_VAULT_KEY = originalVaultKey;
});

describe("software vault crypto", () => {
  it("round-trips secrets without storing plaintext", () => {
    const plaintext = "correct horse battery staple / Motion Array";
    const ciphertext = encryptSoftwareSecret(plaintext);

    expect(ciphertext).not.toContain(plaintext);
    expect(ciphertext.split(".")).toHaveLength(4);
    expect(decryptSoftwareSecret(ciphertext)).toBe(plaintext);
  });

  it("uses a fresh IV for repeated values", () => {
    const first = encryptSoftwareSecret("same password");
    const second = encryptSoftwareSecret("same password");

    expect(first).not.toBe(second);
    expect(decryptSoftwareSecret(first)).toBe("same password");
    expect(decryptSoftwareSecret(second)).toBe("same password");
  });

  it("fails closed when ciphertext is tampered with", () => {
    const ciphertext = encryptSoftwareSecret("secret");
    const parts = ciphertext.split(".");
    const encodedCiphertext = parts[3];
    expect(encodedCiphertext).toBeDefined();
    if (!encodedCiphertext) throw new Error("Expected ciphertext segment");
    const last = encodedCiphertext.endsWith("A") ? "B" : "A";
    parts[3] = `${encodedCiphertext.slice(0, -1)}${last}`;

    expect(() => decryptSoftwareSecret(parts.join("."))).toThrow("Invalid software vault ciphertext");
  });

  it("fails closed when the dedicated key is missing or malformed", () => {
    delete process.env.SOFTWARE_VAULT_KEY;
    expect(() => encryptSoftwareSecret("secret")).toThrow("Missing required environment variable: SOFTWARE_VAULT_KEY");

    process.env.SOFTWARE_VAULT_KEY = Buffer.alloc(16, 3).toString("base64");
    expect(() => encryptSoftwareSecret("secret")).toThrow("SOFTWARE_VAULT_KEY must decode to exactly 32 bytes");

    process.env.SOFTWARE_VAULT_KEY = `${Buffer.alloc(32, 3).toString("base64").slice(0, -1)}!`;
    expect(() => encryptSoftwareSecret("secret")).toThrow("SOFTWARE_VAULT_KEY must decode to exactly 32 bytes");
  });
});

describe("software vault source contracts", () => {
  it("keeps passwords out of list responses and gates internal access", () => {
    const route = source("src/app/api/software/route.ts");
    const permissions = source("src/lib/permissions.ts");
    const service = source("src/lib/services/software.ts");

    expect(route).toContain('requirePermission(user.role, "software", "view")');
    expect(route).toContain("listSoftwareCredentials(includeArchived)");
    expect(route).not.toContain("password: body.password");
    expect(permissions).toContain('software: {');
    expect(permissions).toContain('view: ["ADMIN", "STAFF", "STUDENT"]');
    expect(permissions).toContain('manage: ["ADMIN", "STAFF"]');
    expect(service).toContain("decryptSoftwareSecret(row.accountEmailCiphertext)");
    expect(service).toContain("passwordCiphertext");
  });

  it("uses an audited, rate-limited reveal boundary", () => {
    const route = source("src/app/api/software/[id]/secret/route.ts");

    expect(route).toContain('requirePermission(user.role, "software", "reveal")');
    expect(route).toContain('software:reveal:${user.id}');
    expect(route).toContain('action: "reveal_password"');
    expect(route).toContain('return ok({ data: { password: credential.password } });');
    expect(route).not.toContain("after: { password:");
  });

  it("keeps the page masked until an explicit secret request", () => {
    const sidebar = source("src/components/Sidebar.tsx");
    const page = source("src/app/(app)/licenses/page.tsx");
    const vault = source("src/app/(app)/licenses/SoftwareVault.tsx");
    const schema = source("prisma/schema.prisma");

    expect(sidebar).toContain('{ label: "Software", href: "/licenses"');
    expect(page).toContain('<SoftwareVault isAdmin={isAdmin} />');
    expect(vault).toContain('fetch(`/api/software/${id}/secret`)');
    expect(vault).toContain("••••••••••••");
    expect(vault).toContain("Reveals are logged");
    expect(schema).toContain("accountEmailCiphertext");
    expect(schema).toContain("passwordCiphertext");
  });
});

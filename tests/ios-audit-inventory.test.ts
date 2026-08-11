import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const scriptSource = readFileSync("scripts/ios-audit-inventory.sh", "utf8");

describe("iOS audit inventory", () => {
  it("fails closed on missing or unregistered audit surfaces", () => {
    const result = spawnSync("bash", ["scripts/ios-audit-inventory.sh", "--gaps"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(result.status, result.stderr || result.stdout).toBe(0);
    expect(result.stdout).toContain("✓ no audit gaps");
    expect(result.stdout).toContain("Missing audit:        0");
    expect(scriptSource).toMatch(/elif \[ "\$MODE" = "gaps" \]; then\s+exit 1/);
  });
});

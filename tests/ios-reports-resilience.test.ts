import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const viewSource = readFileSync("ios/Wisconsin/Views/ReportsView.swift", "utf8");
const modelSource = readFileSync("ios/Wisconsin/Models/Models.swift", "utf8");

describe("native Reports resilience contract", () => {
  it("lets a new period replace active work and gives publishing to one request owner", () => {
    expect(viewSource).toContain("activeLoadID");
    expect(viewSource).toContain("activeWindow");
    expect(viewSource).toContain("guard !isLoading || activeWindow != window else { return }");
    expect(viewSource).toContain("guard activeLoadID == loadID, window == days else { return }");
  });

  it("loads utilization and checkout activity as independent failure domains", () => {
    expect(viewSource).toContain("ReportLoadOutcome<UtilizationReport>");
    expect(viewSource).toContain("ReportLoadOutcome<CheckoutActivityReport>");
    expect(viewSource).toContain("switch utilizationOutcome");
    expect(viewSource).toContain("switch checkoutOutcome");
    expect(viewSource).not.toContain("try await (utilizationTask, checkoutTask)");
  });

  it("decodes additive report failure metadata and refuses to mark partial data fresh", () => {
    expect(modelSource.match(/let partialFailures: \[String\]\?/g)).toHaveLength(2);
    expect(viewSource).toContain("result.partialFailures");
    expect(viewSource).toContain("lastLoadedAt = utilizationComplete && checkoutsComplete ? Date() : nil");
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const licensesPageSource = readFileSync(
  join(process.cwd(), "src/app/(app)/licenses/page.tsx"),
  "utf8",
);
const licenseTableSource = readFileSync(
  join(process.cwd(), "src/app/(app)/licenses/LicenseTable.tsx"),
  "utf8",
);
const myLicensePanelSource = readFileSync(
  join(process.cwd(), "src/app/(app)/licenses/MyLicensePanel.tsx"),
  "utf8",
);
const confirmClaimDialogSource = readFileSync(
  join(process.cwd(), "src/app/(app)/licenses/ConfirmClaimDialog.tsx"),
  "utf8",
);

describe("license page operator queue contracts", () => {
  it("keeps license queue filters in URL state", () => {
    expect(licensesPageSource).toMatch(/useSearchParams/);
    expect(licensesPageSource).toMatch(/usePathname/);
    expect(licensesPageSource).toMatch(/useRouter/);
  });

  it("defines every supported queue filter value", () => {
    for (const filter of ["open", "partial", "full", "expiring", "expired", "retired"]) {
      expect(licensesPageSource).toContain(`"${filter}"`);
    }
  });

  it("surfaces stale visible rows when refresh fails after data loaded", () => {
    expect(licensesPageSource).toContain("Visible rows may be stale");
    expect(licensesPageSource).toMatch(/codesError && allCodes\.length > 0/);
    expect(licensesPageSource).toMatch(/onClick=\{reloadAll\}/);
  });

  it("does not render partial license rows with the old blue status language", () => {
    expect(licenseTableSource).not.toMatch(/status === "PARTIAL"[^\n]+bg-blue/);
    expect(licenseTableSource).not.toMatch(/status === "PARTIAL"[^\n]+variant="blue"/);
    expect(licenseTableSource).toMatch(/status === "PARTIAL"[^\n]+variant="orange"/);
  });

  it("branches active-license card tone for expired and expiring states", () => {
    expect(myLicensePanelSource).toContain("cardToneClass");
    expect(myLicensePanelSource).toMatch(/isExpired[\s\S]+isExpiringSoon[\s\S]+border-green-200/);
    expect(myLicensePanelSource).not.toMatch(/<Card className="border-green-200/);
  });

  it("handles clipboard failure after a successful claim without throwing away the claim", () => {
    expect(confirmClaimDialogSource).toContain("copyLicenseCode");
    expect(confirmClaimDialogSource).toMatch(/try \{[\s\S]+navigator\.clipboard\.writeText\(code\)[\s\S]+catch \{/);
    expect(confirmClaimDialogSource).toContain(
      "License claimed. Copy failed; copy the code from your license banner.",
    );
    expect(confirmClaimDialogSource).toMatch(/onClaimed\(\);[\s\S]+onOpenChange\(false\);/);
  });
});

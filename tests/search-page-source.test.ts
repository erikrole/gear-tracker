import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("full search page source", () => {
  it("does not render blank item result titles when item identity fields are sparse", () => {
    const source = readFileSync("src/app/(app)/search/page.tsx", "utf8");

    expect(source).toContain('import { assetSearchTitle } from "@/lib/search-result-title";');
    expect(source).toContain("title: assetSearchTitle(item)");
  });

  it("uses shared named partial-results visibility for degraded search sources", () => {
    const source = readFileSync("src/app/(app)/search/page.tsx", "utf8");

    expect(source).toContain('import { OperationalPartialResultsAlert } from "@/components/OperationalFeedback";');
    expect(source).toContain("const [partialFailures, setPartialFailures] = useState<string[]>([]);");
    expect(source).toContain("failures.push(SEARCH_RESULT_SOURCES.items)");
    expect(source).toContain("failures.push(SEARCH_RESULT_SOURCES.checkouts)");
    expect(source).toContain("failures.push(SEARCH_RESULT_SOURCES.reservations)");
    expect(source).toContain("failures.push(SEARCH_RESULT_SOURCES.users)");
    expect(source).toContain("<OperationalPartialResultsAlert");
    expect(source).toContain('failureLabel="Unavailable result types"');
    expect(source).not.toContain("Some result types could not load. Showing available matches.");
  });
});

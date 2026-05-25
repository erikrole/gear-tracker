import { describe, expect, it } from "vitest";
import { parseResourceFilter, parseResourceSort } from "@/app/(app)/resources/filters";

function params(query: string) {
  return new URLSearchParams(query);
}

describe("resources URL filters", () => {
  it("parses current filter params", () => {
    expect(parseResourceFilter(params("filter=contacts"))).toBe("contacts");
    expect(parseResourceFilter(params("filter=area-video"))).toBe("area-video");
  });

  it("keeps legacy guide view and area links working after the resources rename", () => {
    expect(parseResourceFilter(params("view=media-drive"))).toBe("media-drive");
    expect(parseResourceFilter(params("view=server-paths"))).toBe("server-paths");
    expect(parseResourceFilter(params("area=video"))).toBe("area-video");
    expect(parseResourceFilter(params("area=GRAPHICS"))).toBe("area-graphics");
  });

  it("prefers current filter params over legacy compatibility params", () => {
    expect(parseResourceFilter(params("filter=contacts&view=media-drive&area=video"))).toBe("contacts");
  });

  it("rejects unknown filters and sort values to stable defaults", () => {
    expect(parseResourceFilter(params("filter=unknown&view=bad&area=bad"))).toBe("all");
    expect(parseResourceSort("missing")).toBe("personalized");
    expect(parseResourceSort("title")).toBe("title");
    expect(parseResourceSort("RECENT")).toBe("recent");
  });
});

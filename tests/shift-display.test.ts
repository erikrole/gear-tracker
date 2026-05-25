import { describe, expect, it } from "vitest";
import {
  shiftWorkerLabel,
  shiftWorkerSlotLabel,
  shiftWorkerTypeForRole,
} from "@/lib/shift-display";

describe("shift display helpers", () => {
  it("maps internal worker types to spelled-out labels", () => {
    expect(shiftWorkerLabel("FT")).toBe("Staff");
    expect(shiftWorkerLabel("ST")).toBe("Student");
    expect(shiftWorkerSlotLabel("FT")).toBe("Staff slot");
    expect(shiftWorkerSlotLabel("ST")).toBe("Student slot");
  });

  it("maps user roles to planned worker types", () => {
    expect(shiftWorkerTypeForRole("ADMIN")).toBe("FT");
    expect(shiftWorkerTypeForRole("STAFF")).toBe("FT");
    expect(shiftWorkerTypeForRole("STUDENT")).toBe("ST");
  });

  it("keeps role matching as a slot-selection concern, not display copy", () => {
    expect(shiftWorkerTypeForRole("STAFF")).toBe("FT");
    expect(shiftWorkerSlotLabel(shiftWorkerTypeForRole("STAFF"))).toBe("Staff slot");
    expect(shiftWorkerTypeForRole("STUDENT")).toBe("ST");
    expect(shiftWorkerSlotLabel(shiftWorkerTypeForRole("STUDENT"))).toBe("Student slot");
  });
});

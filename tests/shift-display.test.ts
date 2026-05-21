import { describe, expect, it } from "vitest";
import {
  assignedRoleMismatchLabel,
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

  it("describes cross-role assignments as explicit exceptions", () => {
    expect(
      assignedRoleMismatchLabel({
        plannedWorkerType: "FT",
        assignedRole: "STUDENT",
      })
    ).toBe("Student assigned to Staff slot");
    expect(
      assignedRoleMismatchLabel({
        plannedWorkerType: "ST",
        assignedRole: "STAFF",
      })
    ).toBe("Staff assigned to Student slot");
    expect(
      assignedRoleMismatchLabel({
        plannedWorkerType: "ST",
        assignedRole: "STUDENT",
      })
    ).toBeNull();
  });
});

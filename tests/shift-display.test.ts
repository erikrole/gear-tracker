import { describe, expect, it } from "vitest";
import {
  formatRoleSlotAssignmentOutcome,
  shiftWorkerLabel,
  shiftWorkerLabelForProfile,
  shiftWorkerLabelForRole,
  shiftWorkerSlotLabel,
  shiftWorkerTypeForProfile,
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

  it("maps assigned user roles to person-facing labels", () => {
    expect(shiftWorkerLabelForRole("ADMIN")).toBe("Staff");
    expect(shiftWorkerLabelForRole("STAFF")).toBe("Staff");
    expect(shiftWorkerLabelForRole("STUDENT")).toBe("Student");
    expect(shiftWorkerLabelForRole("student")).toBe("Student");
    expect(shiftWorkerLabelForRole(null)).toBeNull();
    expect(shiftWorkerLabelForRole("")).toBeNull();
  });

  it("uses student profile signals for scheduling worker labels", () => {
    expect(shiftWorkerTypeForProfile({ role: "STAFF", areaAssignments: [{ area: "VIDEO", isPrimary: true }] })).toBe("ST");
    expect(shiftWorkerLabelForProfile({ role: "STAFF", sportAssignments: [{ sportCode: "WSOC" }] })).toBe("Student");
    expect(shiftWorkerLabelForProfile({ role: "STAFF", gradYear: 2027 })).toBe("Student");
    expect(shiftWorkerLabelForProfile({ role: "STAFF" })).toBe("Staff");
    expect(shiftWorkerLabelForProfile({ role: null })).toBeNull();
  });

  it("keeps role matching as a slot-selection concern, not display copy", () => {
    expect(shiftWorkerTypeForRole("STAFF")).toBe("FT");
    expect(shiftWorkerSlotLabel(shiftWorkerTypeForRole("STAFF"))).toBe("Staff slot");
    expect(shiftWorkerTypeForRole("STUDENT")).toBe("ST");
    expect(shiftWorkerSlotLabel(shiftWorkerTypeForRole("STUDENT"))).toBe("Student slot");
  });

  it("explains role-slot assignment reroutes without implying the person changed role", () => {
    expect(formatRoleSlotAssignmentOutcome(null, "Ryan")).toBe("Assigned shift");
    expect(formatRoleSlotAssignmentOutcome({
      originalWorkerType: "ST",
      assignedWorkerType: "FT",
      movedToMatchingSlot: true,
      createdMatchingSlot: true,
    }, "Ryan")).toBe("Assigned Ryan to staff slot; created matching slot and left student slot open.");
  });
});

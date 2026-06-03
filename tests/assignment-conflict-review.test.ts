import { describe, expect, it } from "vitest";
import {
  filterCandidatesByConflict,
  filterEventsByAssignmentReview,
  summarizeAssignmentReview,
} from "@/lib/assignment-conflict-review";

describe("assignment conflict review helpers", () => {
  const events = [
    {
      shifts: [
        { assignments: [{ hasConflict: true }] },
        { assignments: [{ hasConflict: false }] },
        { assignments: [] },
      ],
    },
    {
      shifts: [
        { assignments: [{ hasConflict: false }] },
      ],
    },
    {
      shifts: [
        { assignments: [] },
      ],
    },
  ];

  it("summarizes assigned conflicts, clean assignments, and open slots", () => {
    expect(summarizeAssignmentReview(events)).toEqual({
      events: 3,
      totalSlots: 5,
      assigned: 3,
      open: 2,
      conflicts: 1,
      cleanAssignments: 2,
    });
  });

  it("filters events by review state", () => {
    expect(filterEventsByAssignmentReview(events, "all")).toHaveLength(3);
    expect(filterEventsByAssignmentReview(events, "conflicts")).toHaveLength(1);
    expect(filterEventsByAssignmentReview(events, "open")).toHaveLength(2);
    expect(filterEventsByAssignmentReview(events, "clean")).toHaveLength(2);
  });

  it("filters candidates by conflict state from the loaded shift conflict map", () => {
    const users = [
      { id: "student-1", name: "Conflicted" },
      { id: "student-2", name: "Clean" },
      { id: "staff-1", name: "Staff" },
    ];
    const conflictMap = { "student-1": "Conflicts with Exam (10:00-11:00)" };

    expect(filterCandidatesByConflict(users, conflictMap, "all")).toEqual(users);
    expect(filterCandidatesByConflict(users, conflictMap, "conflicts")).toEqual([
      { id: "student-1", name: "Conflicted" },
    ]);
    expect(filterCandidatesByConflict(users, conflictMap, "clean")).toEqual([
      { id: "student-2", name: "Clean" },
      { id: "staff-1", name: "Staff" },
    ]);
  });
});

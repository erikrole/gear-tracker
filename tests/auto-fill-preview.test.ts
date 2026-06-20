import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/services/auto-fill-preview", async () => {
  const actual = await vi.importActual<typeof import("@/lib/services/auto-fill-preview")>("@/lib/services/auto-fill-preview");
  return {
    ...actual,
    getAutoFillPreview: vi.fn(),
  };
});

import { requireAuth } from "@/lib/auth";
import { GET as getPreviewRoute } from "@/app/api/shift-groups/[id]/auto-assign/preview/route";
import { buildAutoFillPreview } from "@/lib/services/auto-fill-preview";
import { getAutoFillPreview } from "@/lib/services/auto-fill-preview";
import type { CandidateRecommendation } from "@/lib/candidate-scoring-types";

const staffUser = {
  id: "staff-1",
  email: "staff@example.com",
  name: "Staff One",
  role: "STAFF" as const,
  staffingType: "FT" as const,
  avatarUrl: null,
  forcePasswordChange: false,
};

const studentUser = {
  ...staffUser,
  id: "student-1",
  role: "STUDENT" as const,
  staffingType: "ST" as const,
};

function params<T extends Record<string, string>>(value: T) {
  return { params: Promise.resolve(value) };
}

function request(path: string) {
  return new Request(`https://app.example.com${path}`, {
    headers: { host: "app.example.com" },
  });
}

function score(overrides: Partial<CandidateRecommendation> & { userId: string; score: number }): CandidateRecommendation {
  return {
    bucket: "recommended",
    reasons: [{ code: "role_fit", label: "Student slot fit", weight: 24 }, { code: "primary_area", label: "Primary area match", weight: 20 }],
    warnings: [],
    blockingConflict: false,
    advisoryConflict: false,
    advisoryConflictNote: null,
    workload: { weekAssignments: 0, weekHours: 0, monthAssignments: 0, monthHours: 0, upcomingAssignments: 0 },
    ...overrides,
  };
}

describe("buildAutoFillPreview", () => {
  const shifts = [
    {
      id: "shift-1",
      area: "VIDEO",
      workerType: "ST",
      startsAt: new Date("2026-10-06T18:00:00.000Z"),
      assignments: [],
    },
    {
      id: "shift-2",
      area: "PHOTO",
      workerType: "ST",
      startsAt: new Date("2026-10-06T18:00:00.000Z"),
      assignments: [],
    },
  ];
  const users = [
    { id: "student-a", name: "A Student", role: "STUDENT", staffingType: "ST" },
    { id: "student-b", name: "B Student", role: "STUDENT", staffingType: "ST" },
  ];

  it("proposes deterministic assignments and avoids using the same candidate twice", () => {
    const preview = buildAutoFillPreview({
      shiftGroupId: "group-1",
      eventId: "event-1",
      eventSummary: "Volleyball",
      generatedAt: new Date("2026-10-01T12:00:00.000Z"),
      shifts,
      users,
      scoresByShiftId: {
        "shift-1": [score({ userId: "student-a", score: 96 }), score({ userId: "student-b", score: 90 })],
        "shift-2": [score({ userId: "student-a", score: 98 }), score({ userId: "student-b", score: 91 })],
      },
    });

    expect(preview.proposals.map((proposal) => [proposal.shiftId, proposal.userId])).toEqual([
      ["shift-1", "student-a"],
      ["shift-2", "student-b"],
    ]);
    expect(preview.proposals.map((proposal) => proposal.userStaffingType)).toEqual(["ST", "ST"]);
    expect(preview.summary).toEqual({ openSlots: 2, proposed: 2, skipped: 0, warnings: 0 });
  });

  it("skips blocking overlaps and keeps advisory warnings visible on proposals", () => {
    const preview = buildAutoFillPreview({
      shiftGroupId: "group-1",
      eventId: "event-1",
      eventSummary: "Volleyball",
      generatedAt: new Date("2026-10-01T12:00:00.000Z"),
      shifts,
      users,
      scoresByShiftId: {
        "shift-1": [
          score({ userId: "student-a", score: 99, blockingConflict: true, warnings: [{ code: "overlapping_assignment", label: "Already assigned during this call window", weight: -60 }] }),
          score({ userId: "student-b", score: 75, bucket: "warning", advisoryConflict: true, advisoryConflictNote: "Conflicts with class", warnings: [{ code: "availability_conflict", label: "Conflicts with class", weight: -25 }] }),
        ],
        "shift-2": [
          score({ userId: "student-a", score: 99, blockingConflict: true, warnings: [{ code: "overlapping_assignment", label: "Already assigned during this call window", weight: -60 }] }),
        ],
      },
    });

    expect(preview.proposals).toHaveLength(1);
    expect(preview.proposals[0]?.userId).toBe("student-b");
    expect(preview.proposals[0]?.warnings[0]?.code).toBe("availability_conflict");
    expect(preview.skipped).toEqual([
      expect.objectContaining({
        shiftId: "shift-2",
        blockingCandidateCount: 1,
      }),
    ]);
  });
});

describe("auto-fill preview route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns preview data for staff without mutating assignments", async () => {
    vi.mocked(requireAuth).mockResolvedValue(staffUser);
    vi.mocked(getAutoFillPreview).mockResolvedValue({
      shiftGroupId: "group-1",
      eventId: "event-1",
      eventSummary: "Volleyball",
      generatedAt: "2026-10-01T12:00:00.000Z",
      proposals: [],
      skipped: [],
      summary: { openSlots: 0, proposed: 0, skipped: 0, warnings: 0 },
    });

    const res = await getPreviewRoute(
      request("/api/shift-groups/group-1/auto-assign/preview"),
      params({ id: "group-1" }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.shiftGroupId).toBe("group-1");
    expect(getAutoFillPreview).toHaveBeenCalledWith("group-1");
  });

  it("denies students from reading staffing previews", async () => {
    vi.mocked(requireAuth).mockResolvedValue(studentUser);

    const res = await getPreviewRoute(
      request("/api/shift-groups/group-1/auto-assign/preview"),
      params({ id: "group-1" }),
    );

    expect(res.status).toBe(403);
    expect(getAutoFillPreview).not.toHaveBeenCalled();
  });
});

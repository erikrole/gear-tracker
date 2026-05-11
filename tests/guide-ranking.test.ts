import { describe, expect, it } from "vitest";
import { Role, ShiftArea } from "@prisma/client";
import { sortGuidesForAudience, type GuideAudience, type RankableGuide } from "@/lib/guide-ranking";

function guide(patch: Partial<RankableGuide> & { id: string; title: string }): RankableGuide {
  return {
    targetRoles: [],
    targetAreas: [],
    featured: false,
    featuredRank: null,
    updatedAt: new Date("2026-05-01T12:00:00Z"),
    ...patch,
  };
}

describe("guide audience ranking", () => {
  it("puts featured video guides before general guides for a video student", () => {
    const audience: GuideAudience = {
      role: Role.STUDENT,
      primaryArea: ShiftArea.VIDEO,
      areaAssignments: [{ area: ShiftArea.VIDEO, isPrimary: true }],
    };

    const ranked = sortGuidesForAudience([
      guide({ id: "general", title: "General SOP" }),
      guide({
        id: "video",
        title: "Video ingest",
        featured: true,
        featuredRank: 1,
        targetRoles: [Role.STUDENT],
        targetAreas: [ShiftArea.VIDEO],
      }),
    ], audience);

    expect(ranked.map((item) => item.id)).toEqual(["video", "general"]);
  });

  it("ranks graphics staff guides before student-only guides for graphics staff", () => {
    const audience: GuideAudience = {
      role: Role.STAFF,
      primaryArea: ShiftArea.GRAPHICS,
      areaAssignments: [{ area: ShiftArea.GRAPHICS, isPrimary: true }],
    };

    const ranked = sortGuidesForAudience([
      guide({ id: "student", title: "Student basics", targetRoles: [Role.STUDENT] }),
      guide({
        id: "graphics",
        title: "Graphics export path",
        targetRoles: [Role.STAFF],
        targetAreas: [ShiftArea.GRAPHICS],
      }),
    ], audience);

    expect(ranked.map((item) => item.id)).toEqual(["graphics", "student"]);
  });

  it("keeps untargeted guides visible as general knowledge base entries", () => {
    const audience: GuideAudience = {
      role: Role.STUDENT,
      primaryArea: null,
      areaAssignments: [],
    };

    const ranked = sortGuidesForAudience([
      guide({ id: "photo", title: "Photo", targetAreas: [ShiftArea.PHOTO] }),
      guide({ id: "general", title: "General contacts" }),
    ], audience);

    expect(ranked.map((item) => item.id)).toContain("general");
  });

  it("preserves personalized ordering inside a filtered result set", () => {
    const audience: GuideAudience = {
      role: Role.STAFF,
      primaryArea: ShiftArea.COMMS,
      areaAssignments: [{ area: ShiftArea.COMMS, isPrimary: true }],
    };

    const filtered = [
      guide({ id: "general", title: "Server paths" }),
      guide({ id: "comms", title: "Comms server paths", targetAreas: [ShiftArea.COMMS] }),
    ];

    expect(sortGuidesForAudience(filtered, audience).map((item) => item.id)).toEqual([
      "comms",
      "general",
    ]);
  });
});

import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { getAllowedRoles } from "@/lib/permissions";
import { buildSignatureDraft, isFreshSignatureDraft, signatureDraftKey } from "@/lib/signatures/drafts";
import { renderSignatureArtifacts } from "@/lib/signatures/artifacts";
import { acceptsSignaturePointer, appendCoalescedPointerEvents } from "@/lib/signatures/pointer";
import { captureSaveRequestSchema, DEFAULT_SIGNATURE_PEN_SETTINGS, signatureCollectionVersionSchema } from "@/lib/signatures/types";
import { compareSignatureRosterMembers } from "@/lib/signatures/roster";
import { buildUWBadgersRosterUrl, isAllowedUWBadgersUrl, normalizedRosterHash, parseUWBadgersRosterHtml } from "@/lib/signatures/uwbadgers";

describe("signature input and draft contracts", () => {
  it("only accepts pen-class drawing input while leaving controls independent", () => {
    expect(acceptsSignaturePointer("pen")).toBe(true);
    expect(acceptsSignaturePointer("touch")).toBe(false);
    expect(acceptsSignaturePointer("mouse")).toBe(false);
    expect(acceptsSignaturePointer("")).toBe(false);
  });

  it("keeps the dispatched Pencil point after coalesced history", () => {
    const historical = { pointerId: 7, clientX: 10, clientY: 10 } as PointerEvent;
    const event = {
      pointerId: 7,
      clientX: 20,
      clientY: 20,
      getCoalescedEvents: () => [historical],
    } as unknown as Pick<PointerEvent, "getCoalescedEvents">;

    expect(appendCoalescedPointerEvents(event)).toEqual([historical, event]);
  });

  it("keys drafts by actor, collection, member, and settings version", () => {
    const key = signatureDraftKey("user", "collection", "member", 3);
    const draft = buildSignatureDraft({ key, userId: "user", collectionId: "collection", memberId: "member", settingsVersion: 3, strokes: [{ points: [{ x: 1, y: 2 }] }] }, 1000);
    expect(key).toBe("user:collection:member:3");
    expect(draft.expiresAt).toBeGreaterThan(draft.savedAt);
    expect(isFreshSignatureDraft(draft, draft.savedAt + 1)).toBe(true);
    expect(isFreshSignatureDraft(draft, draft.expiresAt)).toBe(false);
  });
});

describe("UWBadgers signature roster adapter", () => {
  const html = [
    "<h1>2025-26 Men's Basketball Roster</h1>",
    "<section><h2>Players</h2>",
    "<a href=\"/sports/mens-basketball/roster/alpha-player/100\">Jersey Number 4</a>",
    "<a href=\"/sports/mens-basketball/roster/alpha-player/100\">Alpha Player</a>",
    "<div>Position G Academic Year Jr.</div>",
    "<a href=\"/sports/mens-basketball/roster/alpha-player/100\">Alpha Player</a>",
    "<a href=\"/sports/mens-basketball/roster/beta-player/101\">Jersey Number 22</a>",
    "<a href=\"/sports/mens-basketball/roster/beta-player/101\">Beta Player</a>",
    "</section>",
    "<h2>Coaching Staff</h2>",
    "<a href=\"/sports/mens-basketball/roster/coaches/head-coach/200\">Greg Coach</a><span>Head Coach</span>",
    "<h2>Support Staff</h2>",
    "<a href=\"https://www.uwbadgers.com/sports/mens-basketball/roster/staff/support/300\">Sam Support</a><span>General Manager</span>",
    "<a href=\"/sports/mens-basketball/roster/alpha-player/100\">Alpha Player</a>",
  ].join("");

  it("builds only the fixed pilot URL and validates the host", () => {
    expect(buildUWBadgersRosterUrl("MBB", "2025-26")).toBe("https://uwbadgers.com/sports/mens-basketball/roster/2025-26");
    expect(() => buildUWBadgersRosterUrl("FB", "2025-26")).toThrow();
    expect(isAllowedUWBadgersUrl("https://www.uwbadgers.com/sports/mens-basketball/roster/2025-26")).toBe(true);
    expect(isAllowedUWBadgersUrl("https://example.com/roster")).toBe(false);
  });

  it("deduplicates repeated card/table links by profile identity and preserves source order and role groups", () => {
    const entries = parseUWBadgersRosterHtml(html);
    expect(entries).toHaveLength(4);
    expect(entries.map((entry) => entry.name)).toEqual(["Alpha Player", "Beta Player", "Greg Coach", "Sam Support"]);
    expect(entries.find((entry) => entry.sourceExternalId === "100")?.jerseyNumber).toBe(4);
    expect(entries.find((entry) => entry.sourceExternalId === "200")?.roleGroup).toBe("COACHING_STAFF");
    expect(entries.find((entry) => entry.sourceExternalId === "300")?.roleGroup).toBe("SUPPORT_STAFF");
    expect(normalizedRosterHash(entries)).toBe(normalizedRosterHash([...entries]));
  });
});

describe("signature roster presentation", () => {
  it("sorts players by jersey number and staff by source roster order", () => {
    const members = [
      { name: "Greg Stiemsma", jerseyNumber: null, roleGroup: "COACHING_STAFF" as const, sourceOrder: 2 },
      { name: "Austin Rapp", jerseyNumber: 22, roleGroup: "PLAYER" as const },
      { name: "Brad Davison", jerseyNumber: null, roleGroup: "COACHING_STAFF" as const, sourceOrder: 1 },
      { name: "Jack Janicki", jerseyNumber: 4, roleGroup: "PLAYER" as const },
      { name: "Isaac Riddle", jerseyNumber: 11, roleGroup: "PLAYER" as const },
      { name: "Lance Randall", jerseyNumber: null, roleGroup: "COACHING_STAFF" as const, sourceOrder: 3 },
      { name: "Erik Role", jerseyNumber: null, roleGroup: "CREATIVE_STAFF" as const },
      { name: "Alex Creative", jerseyNumber: null, roleGroup: "CREATIVE_STAFF" as const },
    ];
    const sorted = [...members].sort(compareSignatureRosterMembers);

    expect(sorted.filter((member) => member.roleGroup === "PLAYER").map((member) => member.jerseyNumber)).toEqual([4, 11, 22]);
    expect(sorted.filter((member) => member.roleGroup === "COACHING_STAFF").map((member) => member.name)).toEqual(["Brad Davison", "Greg Stiemsma", "Lance Randall"]);
    expect(sorted.filter((member) => member.roleGroup === "CREATIVE_STAFF").map((member) => member.name)).toEqual(["Alex Creative", "Erik Role"]);
  });

  it("requires a collection version for archive and restore mutations", () => {
    expect(() => signatureCollectionVersionSchema.parse({})).toThrow();
    expect(() => signatureCollectionVersionSchema.parse({ expectedCollectionVersion: 0 })).toThrow();
    expect(signatureCollectionVersionSchema.parse({ expectedCollectionVersion: 3 })).toEqual({ expectedCollectionVersion: 3 });
  });
});

describe("signature artifact contract", () => {
  const strokes = [
    { points: [{ x: 40, y: 50 }, { x: 80, y: 70 }, { x: 120, y: 45 }] },
    { points: [{ x: 130, y: 90 }, { x: 160, y: 100 }] },
  ];

  it("renders identical transparent PNG/SVG artifacts for identical input", async () => {
    const first = await renderSignatureArtifacts(strokes, DEFAULT_SIGNATURE_PEN_SETTINGS);
    const second = await renderSignatureArtifacts(strokes, DEFAULT_SIGNATURE_PEN_SETTINGS);
    expect(first.svg).toBe(second.svg);
    expect(first.svgHash).toBe(second.svgHash);
    expect(first.pngHash).toBe(second.pngHash);
    expect(first.width).toBeGreaterThan(0);
    expect(first.height).toBeGreaterThan(0);
    expect(first.svg).not.toMatch(/script|foreignObject|html|href=/i);
    const metadata = await sharp(first.png).metadata();
    expect(metadata.format).toBe("png");
    expect(metadata.width).toBe(first.width);
    expect(metadata.height).toBe(first.height);
    expect(metadata.hasAlpha).toBe(true);
  });

  it("renders a visible dot for a one-point Pencil stroke", async () => {
    const artifact = await renderSignatureArtifacts([{ points: [{ x: 40, y: 50 }] }], DEFAULT_SIGNATURE_PEN_SETTINGS);
    expect(artifact.svg).toMatch(/M [^ ]+ [^ ]+ L [^ ]+ [^ ]+/);
    const metadata = await sharp(artifact.png).metadata();
    expect(metadata.hasAlpha).toBe(true);
  });

  it("rejects unbounded client stroke payloads", () => {
    expect(() => captureSaveRequestSchema.parse({ requestId: "short", expectedCaptureVersion: 0, settingsVersion: 1, strokes })).toThrow();
    expect(() => captureSaveRequestSchema.parse({ requestId: "request-123456789012", expectedCaptureVersion: 0, settingsVersion: 1, strokes: [{ points: [{ x: -1, y: 4 }] }] })).toThrow();
  });
});

describe("signature permissions", () => {
  it("keeps student and collaborator access closed while staff can capture", () => {
    expect(getAllowedRoles("signature", "capture")).toEqual(["ADMIN", "STAFF"]);
    expect(getAllowedRoles("signature", "settings")).toEqual(["ADMIN"]);
    expect(getAllowedRoles("signature", "download")).not.toContain("STUDENT");
    expect(getAllowedRoles("signature", "download")).not.toContain("COLLABORATOR");
  });
});

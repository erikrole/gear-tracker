import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { getAllowedRoles } from "@/lib/permissions";
import { appendDistinctSignaturePoints, isIpadDevice, signatureCanvasViewport, signaturePointFromClient } from "@/lib/signatures/capture";
import { buildSignatureDraft, isFreshSignatureDraft, signatureDraftKey } from "@/lib/signatures/drafts";
import { renderSignatureArtifacts, SIGNATURE_PNG_MIN_WIDTH } from "@/lib/signatures/artifacts";
import { buildSignatureCurve, signaturePathData } from "@/lib/signatures/geometry";
import { acceptsSignaturePointer, appendCoalescedPointerEvents } from "@/lib/signatures/pointer";
import { captureSaveRequestSchema, DEFAULT_SIGNATURE_PEN_SETTINGS, signatureAdHocMemberSchema, signatureCollectionVersionSchema } from "@/lib/signatures/types";
import { compareSignatureRosterMembers } from "@/lib/signatures/roster";
import { buildUWBadgersRosterUrl, isAllowedUWBadgersUrl, normalizedRosterHash, parseUWBadgersRosterHtml } from "@/lib/signatures/uwbadgers";

describe("signature input and draft contracts", () => {
  it("recognizes iPadOS while rejecting desktop and iPhone clients", () => {
    expect(isIpadDevice("Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)", "iPad", 5)).toBe(true);
    expect(isIpadDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "MacIntel", 5)).toBe(true);
    expect(isIpadDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "MacIntel", 0)).toBe(false);
    expect(isIpadDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", "iPhone", 5)).toBe(false);
  });

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

  it("keys drafts by actor, target, settings, and capture version", () => {
    const key = signatureDraftKey("user", "collection", "member", 3, 7);
    const draft = buildSignatureDraft({
      key,
      userId: "user",
      collectionId: "collection",
      memberId: "member",
      settingsVersion: 3,
      captureVersion: 7,
      canvasSize: { width: 1024, height: 640 },
      strokes: [{ points: [{ x: 1, y: 2 }] }],
    }, 1000);
    expect(key).toBe("user:collection:member:3:7");
    expect(draft.expiresAt).toBeGreaterThan(draft.savedAt);
    expect(isFreshSignatureDraft(draft, draft.savedAt + 1)).toBe(true);
    expect(isFreshSignatureDraft(draft, draft.expiresAt)).toBe(false);
  });

  it("preserves logical signature proportions when the display rotates", () => {
    const viewport = signatureCanvasViewport(
      { width: 500, height: 1_000 },
      { width: 1_000, height: 500 },
    );
    expect(viewport).toEqual({ scale: 0.5, offsetX: 0, offsetY: 375 });
    expect(signaturePointFromClient(
      250,
      500,
      { left: 0, top: 0, width: 500, height: 1_000 },
      { width: 1_000, height: 500 },
    )).toEqual({ x: 500, y: 250 });
    expect(signaturePointFromClient(
      250,
      100,
      { left: 0, top: 0, width: 500, height: 1_000 },
      { width: 1_000, height: 500 },
    )).toBeNull();
  });

  it("keeps real samples while removing only consecutive duplicates", () => {
    const existing = [{ x: 10, y: 20 }];
    expect(appendDistinctSignaturePoints(existing, [{ x: 10, y: 20 }])).toBe(existing);
    expect(appendDistinctSignaturePoints(existing, [
      { x: 10, y: 20 },
      { x: 11, y: 21 },
      { x: 11, y: 21 },
      { x: 12, y: 22 },
    ])).toEqual([
      { x: 10, y: 20 },
      { x: 11, y: 21 },
      { x: 12, y: 22 },
    ]);
  });

  it("keeps the browser capture lifecycle and retry protections wired", () => {
    const source = readFileSync(
      "src/app/(app)/signatures/[id]/capture/[memberId]/SignatureCapturePage.tsx",
      "utf8",
    );
    expect(source).toContain("window.requestAnimationFrame");
    expect(source).toContain("onLostPointerCapture");
    expect(source).toContain('document.addEventListener("visibilitychange"');
    expect(source).toContain('window.addEventListener("pagehide"');
    expect(source).toContain("appendPointerSamples(event.nativeEvent");
    expect(source).toContain("saveRequestIdRef.current ?? crypto.randomUUID()");
    expect(source).toContain("if (response.status < 500 && response.status !== 425) saveRequestIdRef.current = null");
    expect(source).toContain("if (!draftLoaded)");
    expect(source).toContain("draftLoaded && !saving");
    expect(source).toContain("strokesRef.current.length === 0 && (clearedStrokes || redoStack.length > 0)");
    expect(source).toContain("isCurrentDeviceIpad");
    expect(source).toContain("Capture can only be done on an iPad with an Apple Pencil.");
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

  it("builds the supported 2026-27 UWBadgers source URLs and validates the host", () => {
    expect(buildUWBadgersRosterUrl("MBB", "2025-26")).toBe("https://uwbadgers.com/sports/mens-basketball/roster/2025-26");
    expect(buildUWBadgersRosterUrl("FB", "2026-27")).toBe("https://uwbadgers.com/sports/football/roster/2026");
    expect(buildUWBadgersRosterUrl("VB", "2026-27")).toBe("https://uwbadgers.com/sports/womens-volleyball/roster/2026");
    expect(() => buildUWBadgersRosterUrl("CREATIVE", "2026-27")).toThrow();
    expect(isAllowedUWBadgersUrl("https://www.uwbadgers.com/sports/mens-basketball/roster/2025-26")).toBe(true);
    expect(isAllowedUWBadgersUrl("https://example.com/roster")).toBe(false);
  });

  it("deduplicates repeated card/table links by profile identity and preserves source order and role groups", () => {
    const entries = parseUWBadgersRosterHtml(html);
    expect(entries).toHaveLength(4);
    expect(entries.map((entry) => entry.name)).toEqual(["Alpha Player", "Beta Player", "Greg Coach", "Sam Support"]);
    expect(entries.find((entry) => entry.sourceExternalId === "100")?.jerseyNumber).toBe(4);
    expect(entries.find((entry) => entry.sourceExternalId === "100")?.title).toBe("Guard • Junior");
    expect(entries.find((entry) => entry.sourceExternalId === "200")?.roleGroup).toBe("COACHING_STAFF");
    expect(entries.find((entry) => entry.sourceExternalId === "300")?.roleGroup).toBe("SUPPORT_STAFF");
    expect(normalizedRosterHash(entries)).toBe(normalizedRosterHash([...entries]));
  });

  it("parses football and volleyball player metadata from the shared roster structure", () => {
    const footballEntries = parseUWBadgersRosterHtml([
      "<h1>2026 Football Roster</h1>",
      "<a href=\"/sports/football/roster/alpha-player/500\">Jersey Number 7</a>",
      "<a href=\"/sports/football/roster/alpha-player/500\">Alpha Player</a>",
      "<div>Position WR Academic Year R-Sr.Height 6' 2''</div>",
    ].join(""), "FB");
    const volleyballEntries = parseUWBadgersRosterHtml([
      "<h1>2026 Volleyball Roster</h1>",
      "<a href=\"/sports/womens-volleyball/roster/beta-player/600\">Jersey Number 4</a>",
      "<a href=\"/sports/womens-volleyball/roster/beta-player/600\">Beta Player</a>",
      "<div>Position MB Academic Year Jr.Height 6' 2''</div>",
    ].join(""), "VB");

    expect(footballEntries).toHaveLength(1);
    expect(footballEntries[0]).toMatchObject({
      sourceExternalId: "500",
      name: "Alpha Player",
      jerseyNumber: 7,
      title: "Wide Receiver • Redshirt Senior",
    });
    expect(volleyballEntries).toHaveLength(1);
    expect(volleyballEntries[0]).toMatchObject({
      sourceExternalId: "600",
      name: "Beta Player",
      jerseyNumber: 4,
      title: "Middle Blocker • Junior",
    });
  });

  it("decodes HTML entities before reading jersey numbers and labels football safeties", () => {
    const entries = parseUWBadgersRosterHtml([
      "<h1>2026 Football Roster</h1>",
      "<a href=\"/sports/football/roster/danny-oneil/501\" aria-label=\"Danny O&#39;Neil jersey number 18 full bio\">Jersey Number 18</a>",
      "<a href=\"/sports/football/roster/danny-oneil/501\">Danny O&#39;Neil</a>",
      "<div>Position S Academic Year Fr.</div>",
    ].join(""), "FB");

    expect(entries[0]).toMatchObject({
      name: "Danny O'Neil",
      jerseyNumber: 18,
      title: "Safety • Freshman",
    });
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

  it("validates ad-hoc signer identity and category at the API boundary", () => {
    expect(signatureAdHocMemberSchema.parse({ season: "2026-27", name: "  Bucky Badger ", category: " Alumni " })).toEqual({
      season: "2026-27",
      name: "Bucky Badger",
      category: "Alumni",
    });
    expect(() => signatureAdHocMemberSchema.parse({ season: "2026", name: "", category: "" })).toThrow();
  });

  it("keeps roster rows uniform and aligns the signature rail without hiding team positions", () => {
    const source = readFileSync(
      "src/app/(app)/signatures/[id]/SignatureCollectionPage.tsx",
      "utf8",
    );

    expect(source).toContain("grid h-16 grid-cols-");
    expect(source).toContain('<span className="text-center">Signature</span>');
    expect(source).toContain('className="flex items-center justify-center"');
    expect(source).toContain('fontFamily: "var(--font-jersey)", fontWeight: 400');
    expect(source).toContain("bg-[var(--green-bg)]");
    expect(source).toContain("<CheckCircle2");
    expect(source).toContain("Signature complete");
    expect(source).toContain('className="h-auto max-h-8 w-auto max-w-28 object-contain brightness-0 dark:invert"');
    expect(source).toContain('className="h-11 w-40"');
    expect(source).toContain('text-2xl leading-none tracking-[0.06em] tabular-nums');
    expect(source).toContain("!isCreativeStaffRoster && <span");
    expect(source).toContain("member.title || roleLabel(member.roleGroup)");
    expect(source).toContain('title={member.title || roleLabel(member.roleGroup)}');
    expect(source).toContain('variant={member.required ? "brand" : "outline"}');
    expect(source).not.toContain('<span>Requirement</span>');
    expect(source).not.toContain('<span>Status</span>');
    expect(source).not.toContain("Collection readiness");
    expect(source).not.toContain(">Optional</Badge>");
    expect(source).toContain('data-icon="inline-start" />Capture</Link>');
    expect(source).not.toContain('>Needs signature<');
    expect(source).toContain('aria-label={`Quick Look ${member.name}\'s signature`}');
    expect(source).toContain('style={{ fontFamily: "var(--font-heading)", fontWeight: 800 }}');
    expect(source).toContain("useBreadcrumbLabel");
    expect(source).toContain('member.roleGroup !== "PLAYER"');
    expect(source).toContain("<CollapsibleContent>");
    expect(source).toContain('aria-label={`${sectionOpen ? "Collapse" : "Expand"} ${meta.label}`}');
    expect(source).toContain('triggerClassName="size-11"');
    expect(source).toContain("Danger zone");
    expect(source).toContain("Creative Staff is syncing automatically");
    expect(source).toContain("Capture on iPad");
    expect(source).toContain("Capture can only be done on an iPad with an Apple Pencil.");
    expect(source).toContain("disabled");
    expect(source).not.toContain("syncCreativeStaff");
    expect(source).toContain("<AlertDialogTitle>Reset every captured signature?</AlertDialogTitle>");
    expect(source).toContain("/png?download=1");
    expect(source).toContain("/svg?download=1");
  });

  it("uses automatic Creative Staff reconciliation and the final annotated roster copy", () => {
    const landingSource = readFileSync("src/app/(app)/signatures/SignatureCollectionsPage.tsx", "utf8");
    const detailSource = readFileSync("src/app/(app)/signatures/[id]/SignatureCollectionPage.tsx", "utf8");
    const collectionRouteSource = readFileSync("src/app/api/signatures/collections/route.ts", "utf8");

    expect(landingSource).toContain('return "Creative Staff"');
    expect(landingSource).toContain('return "Football"');
    expect(landingSource).toContain('return "Volleyball"');
    expect(landingSource).toContain('id="signature-import-sport"');
    expect(landingSource).toContain('sportCode: importSportCode');
    expect(landingSource).toContain('"Automatically synced"');
    expect(landingSource).not.toContain("Sync staff");
    expect(detailSource).toContain('return "Men’s Basketball"');
    expect(detailSource).toContain('return "Football"');
    expect(detailSource).toContain('return "Volleyball"');
    expect(detailSource).toContain('PLAYER: { label: "Student-Athletes"');
    expect(detailSource).toContain('COACHING_STAFF: { label: "Coaching Staff"');
    expect(detailSource).toContain('SUPPORT_STAFF: { label: "Support Staff"');
    expect(detailSource).toContain('className="h-11 sm:min-w-40"');
    expect(landingSource).toContain("automaticSyncAttempt");
    expect(landingSource).toContain("/creative-staff");
    expect(collectionRouteSource).not.toContain("syncSignatureCreativeStaff");
  });

  it("uses the licensed Wisconsin face only for jersey numbers", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const font = readFileSync("public/Wisconsin-Regular.ttf");

    expect(css).toContain('font-family: "Wisconsin"');
    expect(css).toContain('url("/Wisconsin-Regular.ttf") format("truetype")');
    expect(css).toContain('--font-jersey: "Wisconsin"');
    expect(font.byteLength).toBe(25_004);
    expect(createHash("sha256").update(font).digest("hex")).toBe("37aa1f33c6e005870944890186950fa4b93eaf522eba3e563267fd47b9d8e27a");
  });

  it("uses the official RGB red for web brand actions in both themes", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css.match(/--wi-red: #c80000;/g)).toHaveLength(2);
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
    expect(first.svg).toMatch(/<path d=/);
    expect(first.svg).not.toMatch(/<image|data:|<canvas/i);
    const metadata = await sharp(first.png).metadata();
    const stats = await sharp(first.png).stats();
    expect(metadata.format).toBe("png");
    expect(metadata.width).toBe(first.width);
    expect(metadata.height).toBe(first.height);
    expect(metadata.width).toBeGreaterThanOrEqual(SIGNATURE_PNG_MIN_WIDTH);
    expect(metadata.hasAlpha).toBe(true);
    expect(metadata.channels).toBe(4);
    expect(stats.isOpaque).toBe(false);
    expect(stats.channels[3]?.min).toBe(0);
  });

  it("renders a visible dot for a one-point Pencil stroke", async () => {
    const artifact = await renderSignatureArtifacts([{ points: [{ x: 40, y: 50 }] }], DEFAULT_SIGNATURE_PEN_SETTINGS);
    expect(artifact.svg).toMatch(/M [^ ]+ [^ ]+ L [^ ]+ [^ ]+/);
    const metadata = await sharp(artifact.png).metadata();
    expect(metadata.hasAlpha).toBe(true);
  });

  it("uses midpoint quadratic curves for multi-point strokes", () => {
    const points = [{ x: 40, y: 50 }, { x: 80, y: 70 }, { x: 120, y: 45 }];
    const curve = buildSignatureCurve(points);

    expect(curve.segments).toEqual([
      { type: "Q", control: points[1], to: { x: 100, y: 57.5 } },
      { type: "Q", control: points[2], to: points[2] },
    ]);
    expect(signaturePathData({ points }, { x: 0, y: 0, width: 200, height: 200 })).toContain("Q 80 70 100 57.5");
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

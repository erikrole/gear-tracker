import { describe, it, expect } from "vitest";
import {
  classifyAssetType,
  classifyBulkCategory,
  groupAssetsBySection,
  groupBulkBySection,
  EQUIPMENT_SECTIONS,
  sectionIndex,
  isSectionReachable,
  type EquipmentSectionKey,
} from "@/lib/equipment-sections";

/* ───── classifyAssetType ───── */

describe("classifyAssetType", () => {
  it("classifies camera bodies", () => {
    expect(classifyAssetType("Camera")).toBe("cameras");
    expect(classifyAssetType("DSLR")).toBe("cameras");
    expect(classifyAssetType("Mirrorless")).toBe("cameras");
    expect(classifyAssetType("Video Camera")).toBe("cameras");
    expect(classifyAssetType("Cinema Camera")).toBe("cameras");
    expect(classifyAssetType("Camcorder")).toBe("cameras");
    expect(classifyAssetType("camera body")).toBe("cameras");
  });

  it("classifies lenses", () => {
    expect(classifyAssetType("Lens")).toBe("lenses");
    expect(classifyAssetType("Lenses")).toBe("lenses");
  });

  it("classifies batteries and chargers", () => {
    expect(classifyAssetType("Battery")).toBe("batteries");
    expect(classifyAssetType("Batteries")).toBe("batteries");
    expect(classifyAssetType("Charger")).toBe("batteries");
    expect(classifyAssetType("Power Supply")).toBe("batteries");
    expect(classifyAssetType("V-Mount")).toBe("batteries");
    expect(classifyAssetType("Gold Mount")).toBe("batteries");
  });

  it("classifies accessories (monitors, audio, tripods)", () => {
    expect(classifyAssetType("Monitor")).toBe("accessories");
    expect(classifyAssetType("Recorder")).toBe("accessories");
    expect(classifyAssetType("Gimbal")).toBe("accessories");
    expect(classifyAssetType("Stabilizer")).toBe("accessories");
    expect(classifyAssetType("Wireless Transmitter")).toBe("accessories");
    expect(classifyAssetType("Cage")).toBe("accessories");
    expect(classifyAssetType("Rig")).toBe("accessories");
    expect(classifyAssetType("Microphone")).toBe("accessories");
    expect(classifyAssetType("Audio Mixer")).toBe("accessories");
    expect(classifyAssetType("Tripod")).toBe("accessories");
    expect(classifyAssetType("Slider")).toBe("accessories");
  });

  it("classifies by category name when provided", () => {
    expect(classifyAssetType("equipment", "Cameras")).toBe("cameras");
    expect(classifyAssetType("equipment", "Lenses")).toBe("lenses");
    expect(classifyAssetType("equipment", "Batteries")).toBe("batteries");
    expect(classifyAssetType("equipment", "Monitors")).toBe("accessories");
    expect(classifyAssetType("equipment", "Audio")).toBe("accessories");
    expect(classifyAssetType("equipment", "Tripods")).toBe("accessories");
    expect(classifyAssetType("equipment", "Lighting")).toBe("others");
    expect(classifyAssetType("equipment", "Media Storage")).toBe("others");
    expect(classifyAssetType("equipment", "Office")).toBe("others");
  });

  it("puts unrecognized types in 'others'", () => {
    expect(classifyAssetType("Cable")).toBe("others");
    expect(classifyAssetType("equipment")).toBe("others");
    expect(classifyAssetType("Unknown")).toBe("others");
  });

  it("is case insensitive", () => {
    expect(classifyAssetType("CAMERA")).toBe("cameras");
    expect(classifyAssetType("lens")).toBe("lenses");
    expect(classifyAssetType("BATTERY")).toBe("batteries");
    expect(classifyAssetType("monitor")).toBe("accessories");
  });

  it("handles empty and whitespace", () => {
    expect(classifyAssetType("")).toBe("others");
    expect(classifyAssetType("   ")).toBe("others");
  });

  it("prioritizes cameras over lenses for 'Camera Lens'", () => {
    expect(classifyAssetType("Camera Lens")).toBe("cameras");
  });
});

/* ───── classifyBulkCategory ───── */

describe("classifyBulkCategory", () => {
  it("uses same logic as asset type classification", () => {
    expect(classifyBulkCategory("Battery")).toBe("batteries");
    expect(classifyBulkCategory("Cable")).toBe("others");
    expect(classifyBulkCategory("Lens")).toBe("lenses");
  });
});

/* ───── groupAssetsBySection ───── */

describe("groupAssetsBySection", () => {
  const assets = [
    { id: "a1", type: "Camera", assetTag: "CAM-001" },
    { id: "a2", type: "Lens", assetTag: "LNS-001" },
    { id: "a3", type: "Battery", assetTag: "BAT-001" },
    { id: "a4", type: "Monitor", assetTag: "MON-001" },
    { id: "a5", type: "Cable", assetTag: "CBL-001" },
    { id: "a6", type: "Camera", assetTag: "CAM-002" },
  ];

  it("groups assets into correct sections", () => {
    const groups = groupAssetsBySection(assets);
    expect(groups.cameras.map((a) => a.id)).toEqual(["a1", "a6"]);
    expect(groups.lenses.map((a) => a.id)).toEqual(["a2"]);
    expect(groups.batteries.map((a) => a.id)).toEqual(["a3"]);
    expect(groups.accessories.map((a) => a.id)).toEqual(["a4"]);
    expect(groups.others.map((a) => a.id)).toEqual(["a5"]);
  });

  it("returns empty arrays for sections with no items", () => {
    const groups = groupAssetsBySection([{ id: "x", type: "Camera" }]);
    expect(groups.lenses).toEqual([]);
    expect(groups.batteries).toEqual([]);
    expect(groups.accessories).toEqual([]);
    expect(groups.others).toEqual([]);
  });

  it("handles empty input", () => {
    const groups = groupAssetsBySection([]);
    for (const key of Object.keys(groups) as EquipmentSectionKey[]) {
      expect(groups[key]).toEqual([]);
    }
  });
});

/* ───── groupBulkBySection ───── */

describe("groupBulkBySection", () => {
  it("groups bulk SKUs into correct sections", () => {
    const skus = [
      { id: "b1", category: "Battery" },
      { id: "b2", category: "Cable" },
      { id: "b3", category: "Charger" },
    ];
    const groups = groupBulkBySection(skus);
    expect(groups.batteries.map((s) => s.id)).toEqual(["b1", "b3"]);
    expect(groups.others.map((s) => s.id)).toEqual(["b2"]);
  });
});

/* ───── EQUIPMENT_SECTIONS constant ───── */

describe("EQUIPMENT_SECTIONS", () => {
  it("has 5 sections in the correct order: Cameras → Lenses → Batteries → Accessories → Others", () => {
    expect(EQUIPMENT_SECTIONS).toHaveLength(5);
    expect(EQUIPMENT_SECTIONS.map((s) => s.key)).toEqual([
      "cameras", "lenses", "batteries", "accessories", "others",
    ]);
  });

  it("every section has label and description", () => {
    for (const sec of EQUIPMENT_SECTIONS) {
      expect(sec.label).toBeTruthy();
      expect(sec.description).toBeTruthy();
    }
  });
});

/* ───── sectionIndex ───── */

describe("sectionIndex", () => {
  it("returns correct indices for all sections", () => {
    expect(sectionIndex("cameras")).toBe(0);
    expect(sectionIndex("lenses")).toBe(1);
    expect(sectionIndex("batteries")).toBe(2);
    expect(sectionIndex("accessories")).toBe(3);
    expect(sectionIndex("others")).toBe(4);
  });
});

/* ───── isSectionReachable (all tabs always reachable) ───── */

describe("isSectionReachable", () => {
  it("all sections are always reachable", () => {
    expect(isSectionReachable("cameras", "cameras")).toBe(true);
    expect(isSectionReachable("lenses", "cameras")).toBe(true);
    expect(isSectionReachable("batteries", "cameras")).toBe(true);
    expect(isSectionReachable("accessories", "cameras")).toBe(true);
    expect(isSectionReachable("others", "cameras")).toBe(true);
  });
});

/* ───── "Everything Else" catch-all ───── */

describe("catch-all behavior", () => {
  it("items with no recognized category or type end up in 'others'", () => {
    const miscTypes = ["Cable", "Tape", "Bag", "Case", "equipment", "foo bar"];
    for (const t of miscTypes) {
      expect(classifyAssetType(t)).toBe("others");
    }
  });
});

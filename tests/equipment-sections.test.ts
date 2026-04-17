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

  it("classifies audio gear", () => {
    expect(classifyAssetType("Microphone")).toBe("audio");
    expect(classifyAssetType("Audio Mixer")).toBe("audio");
    expect(classifyAssetType("Recorder")).toBe("audio");
    expect(classifyAssetType("Wireless Transmitter")).toBe("audio");
    expect(classifyAssetType("Lavalier")).toBe("audio");
    expect(classifyAssetType("Shotgun Mic")).toBe("audio");
  });

  it("classifies tripods and support", () => {
    expect(classifyAssetType("Tripod")).toBe("tripods");
    expect(classifyAssetType("Monopod")).toBe("tripods");
    expect(classifyAssetType("Slider")).toBe("tripods");
  });

  it("classifies lighting", () => {
    expect(classifyAssetType("Light")).toBe("lighting");
    expect(classifyAssetType("LED Panel")).toBe("lighting");
    expect(classifyAssetType("Fresnel")).toBe("lighting");
  });

  it("classifies by category name when provided", () => {
    expect(classifyAssetType("equipment", "Cameras")).toBe("cameras");
    expect(classifyAssetType("equipment", "Lenses")).toBe("lenses");
    expect(classifyAssetType("equipment", "Batteries")).toBe("batteries");
    expect(classifyAssetType("equipment", "Audio")).toBe("audio");
    expect(classifyAssetType("equipment", "Microphones")).toBe("audio");
    expect(classifyAssetType("equipment", "Tripods")).toBe("tripods");
    expect(classifyAssetType("equipment", "Lighting")).toBe("lighting");
    expect(classifyAssetType("equipment", "Monitors")).toBe("other");
    expect(classifyAssetType("equipment", "Media Storage")).toBe("other");
    expect(classifyAssetType("equipment", "Office")).toBe("other");
  });

  it("puts unrecognized types in 'other'", () => {
    expect(classifyAssetType("Cable")).toBe("other");
    expect(classifyAssetType("equipment")).toBe("other");
    expect(classifyAssetType("Unknown")).toBe("other");
    expect(classifyAssetType("Monitor")).toBe("other");
    expect(classifyAssetType("Gimbal")).toBe("other");
  });

  it("is case insensitive", () => {
    expect(classifyAssetType("CAMERA")).toBe("cameras");
    expect(classifyAssetType("lens")).toBe("lenses");
    expect(classifyAssetType("BATTERY")).toBe("batteries");
    expect(classifyAssetType("MICROPHONE")).toBe("audio");
    expect(classifyAssetType("TRIPOD")).toBe("tripods");
  });

  it("handles empty and whitespace", () => {
    expect(classifyAssetType("")).toBe("other");
    expect(classifyAssetType("   ")).toBe("other");
  });

  it("prioritizes cameras over lenses for 'Camera Lens'", () => {
    expect(classifyAssetType("Camera Lens")).toBe("cameras");
  });
});

/* ───── classifyBulkCategory ───── */

describe("classifyBulkCategory", () => {
  it("uses same logic as asset type classification", () => {
    expect(classifyBulkCategory("Battery")).toBe("batteries");
    expect(classifyBulkCategory("Cable")).toBe("other");
    expect(classifyBulkCategory("Lens")).toBe("lenses");
    expect(classifyBulkCategory("Microphone")).toBe("audio");
    expect(classifyBulkCategory("Tripod")).toBe("tripods");
  });
});

/* ───── groupAssetsBySection ───── */

describe("groupAssetsBySection", () => {
  const assets = [
    { id: "a1", type: "Camera", assetTag: "CAM-001" },
    { id: "a2", type: "Lens", assetTag: "LNS-001" },
    { id: "a3", type: "Battery", assetTag: "BAT-001" },
    { id: "a4", type: "Microphone", assetTag: "MIC-001" },
    { id: "a5", type: "Tripod", assetTag: "TRP-001" },
    { id: "a6", type: "LED Panel", assetTag: "LGT-001" },
    { id: "a7", type: "Cable", assetTag: "CBL-001" },
    { id: "a8", type: "Camera", assetTag: "CAM-002" },
  ];

  it("groups assets into correct sections", () => {
    const groups = groupAssetsBySection(assets);
    expect(groups.cameras.map((a) => a.id)).toEqual(["a1", "a8"]);
    expect(groups.lenses.map((a) => a.id)).toEqual(["a2"]);
    expect(groups.batteries.map((a) => a.id)).toEqual(["a3"]);
    expect(groups.audio.map((a) => a.id)).toEqual(["a4"]);
    expect(groups.tripods.map((a) => a.id)).toEqual(["a5"]);
    expect(groups.lighting.map((a) => a.id)).toEqual(["a6"]);
    expect(groups.other.map((a) => a.id)).toEqual(["a7"]);
  });

  it("returns empty arrays for sections with no items", () => {
    const groups = groupAssetsBySection([{ id: "x", type: "Camera" }]);
    expect(groups.lenses).toEqual([]);
    expect(groups.batteries).toEqual([]);
    expect(groups.audio).toEqual([]);
    expect(groups.tripods).toEqual([]);
    expect(groups.lighting).toEqual([]);
    expect(groups.other).toEqual([]);
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
      { id: "b4", category: "Microphone" },
    ];
    const groups = groupBulkBySection(skus);
    expect(groups.batteries.map((s) => s.id)).toEqual(["b1", "b3"]);
    expect(groups.other.map((s) => s.id)).toEqual(["b2"]);
    expect(groups.audio.map((s) => s.id)).toEqual(["b4"]);
  });
});

/* ───── EQUIPMENT_SECTIONS constant ───── */

describe("EQUIPMENT_SECTIONS", () => {
  it("has 7 sections in the correct order: Cameras → Lenses → Batteries → Audio → Tripods → Lighting → Other", () => {
    expect(EQUIPMENT_SECTIONS).toHaveLength(7);
    expect(EQUIPMENT_SECTIONS.map((s) => s.key)).toEqual([
      "cameras", "lenses", "batteries", "audio", "tripods", "lighting", "other",
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
    expect(sectionIndex("audio")).toBe(3);
    expect(sectionIndex("tripods")).toBe(4);
    expect(sectionIndex("lighting")).toBe(5);
    expect(sectionIndex("other")).toBe(6);
  });
});

/* ───── isSectionReachable (all tabs always reachable) ───── */

describe("isSectionReachable", () => {
  it("all sections are always reachable", () => {
    expect(isSectionReachable("cameras", "cameras")).toBe(true);
    expect(isSectionReachable("lenses", "cameras")).toBe(true);
    expect(isSectionReachable("batteries", "cameras")).toBe(true);
    expect(isSectionReachable("audio", "cameras")).toBe(true);
    expect(isSectionReachable("tripods", "cameras")).toBe(true);
    expect(isSectionReachable("lighting", "cameras")).toBe(true);
    expect(isSectionReachable("other", "cameras")).toBe(true);
  });
});

/* ───── "Everything Else" catch-all ───── */

describe("catch-all behavior", () => {
  it("items with no recognized category or type end up in 'other'", () => {
    const miscTypes = ["Cable", "Tape", "Bag", "Case", "equipment", "foo bar"];
    for (const t of miscTypes) {
      expect(classifyAssetType(t)).toBe("other");
    }
  });
});

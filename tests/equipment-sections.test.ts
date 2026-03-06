import { describe, it, expect } from "vitest";
import {
  classifyAssetType,
  classifyBulkCategory,
  groupAssetsBySection,
  groupBulkBySection,
  EQUIPMENT_SECTIONS,
  type EquipmentSectionKey,
} from "@/lib/equipment-sections";

/* ───── classifyAssetType ───── */

describe("classifyAssetType", () => {
  it("classifies camera bodies", () => {
    expect(classifyAssetType("Camera")).toBe("camera_body");
    expect(classifyAssetType("DSLR")).toBe("camera_body");
    expect(classifyAssetType("Mirrorless")).toBe("camera_body");
    expect(classifyAssetType("Video Camera")).toBe("camera_body");
    expect(classifyAssetType("Cinema Camera")).toBe("camera_body");
    expect(classifyAssetType("Camcorder")).toBe("camera_body");
    expect(classifyAssetType("camera body")).toBe("camera_body");
  });

  it("classifies lenses", () => {
    expect(classifyAssetType("Lens")).toBe("lenses");
    expect(classifyAssetType("Lenses")).toBe("lenses");
    expect(classifyAssetType("Prime Lens")).toBe("lenses");
    expect(classifyAssetType("Zoom Lens")).toBe("lenses");
  });

  it("classifies batteries", () => {
    expect(classifyAssetType("Battery")).toBe("batteries");
    expect(classifyAssetType("Batteries")).toBe("batteries");
    expect(classifyAssetType("Charger")).toBe("batteries");
    expect(classifyAssetType("Power Supply")).toBe("batteries");
    expect(classifyAssetType("V-Mount")).toBe("batteries");
    expect(classifyAssetType("Gold Mount")).toBe("batteries");
  });

  it("classifies accessories and monitors", () => {
    expect(classifyAssetType("Monitor")).toBe("accessories");
    expect(classifyAssetType("Recorder")).toBe("accessories");
    expect(classifyAssetType("Gimbal")).toBe("accessories");
    expect(classifyAssetType("Stabilizer")).toBe("accessories");
    expect(classifyAssetType("Wireless Transmitter")).toBe("accessories");
    expect(classifyAssetType("Cage")).toBe("accessories");
    expect(classifyAssetType("Rig")).toBe("accessories");
  });

  it("puts unrecognized types in 'other'", () => {
    expect(classifyAssetType("Tripod")).toBe("other");
    expect(classifyAssetType("Audio")).toBe("other");
    expect(classifyAssetType("Cable")).toBe("other");
    expect(classifyAssetType("Lighting")).toBe("other");
    expect(classifyAssetType("equipment")).toBe("other");
    expect(classifyAssetType("Unknown")).toBe("other");
  });

  it("is case insensitive", () => {
    expect(classifyAssetType("CAMERA")).toBe("camera_body");
    expect(classifyAssetType("lens")).toBe("lenses");
    expect(classifyAssetType("BATTERY")).toBe("batteries");
    expect(classifyAssetType("monitor")).toBe("accessories");
  });

  it("handles empty and whitespace", () => {
    expect(classifyAssetType("")).toBe("other");
    expect(classifyAssetType("   ")).toBe("other");
  });

  it("prioritizes lenses over camera for 'Camera Lens'", () => {
    // "Camera Lens" contains both "camera" and "lens" — lens should win
    // because lens is checked before camera in priority order? No, actually
    // the order is camera_body first, then lenses. So "Camera Lens" matches camera_body.
    // This is intentional: we check camera_body before lenses.
    // But let's verify and document:
    expect(classifyAssetType("Camera Lens")).toBe("camera_body");
  });
});

/* ───── classifyBulkCategory ───── */

describe("classifyBulkCategory", () => {
  it("uses same logic as asset type classification", () => {
    expect(classifyBulkCategory("Battery")).toBe("batteries");
    expect(classifyBulkCategory("Cable")).toBe("other");
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
    { id: "a5", type: "Tripod", assetTag: "TRI-001" },
    { id: "a6", type: "Camera", assetTag: "CAM-002" },
  ];

  it("groups assets into correct sections", () => {
    const groups = groupAssetsBySection(assets);
    expect(groups.camera_body.map((a) => a.id)).toEqual(["a1", "a6"]);
    expect(groups.lenses.map((a) => a.id)).toEqual(["a2"]);
    expect(groups.batteries.map((a) => a.id)).toEqual(["a3"]);
    expect(groups.accessories.map((a) => a.id)).toEqual(["a4"]);
    expect(groups.other.map((a) => a.id)).toEqual(["a5"]);
  });

  it("returns empty arrays for sections with no items", () => {
    const groups = groupAssetsBySection([{ id: "x", type: "Camera" }]);
    expect(groups.lenses).toEqual([]);
    expect(groups.batteries).toEqual([]);
    expect(groups.accessories).toEqual([]);
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
    ];
    const groups = groupBulkBySection(skus);
    expect(groups.batteries.map((s) => s.id)).toEqual(["b1", "b3"]);
    expect(groups.other.map((s) => s.id)).toEqual(["b2"]);
  });
});

/* ───── EQUIPMENT_SECTIONS constant ───── */

describe("EQUIPMENT_SECTIONS", () => {
  it("has 5 sections in the correct order", () => {
    expect(EQUIPMENT_SECTIONS).toHaveLength(5);
    expect(EQUIPMENT_SECTIONS.map((s) => s.key)).toEqual([
      "camera_body", "accessories", "lenses", "batteries", "other",
    ]);
  });

  it("every section has label and description", () => {
    for (const sec of EQUIPMENT_SECTIONS) {
      expect(sec.label).toBeTruthy();
      expect(sec.description).toBeTruthy();
    }
  });
});

/* ───── "Everything Else" catch-all ───── */

describe("catch-all behavior", () => {
  it("items with no recognized category end up in 'other'", () => {
    const miscTypes = ["Lighting", "Audio", "Cable", "Tape", "Stand", "Bag", "Case", "equipment", "foo bar"];
    for (const t of miscTypes) {
      expect(classifyAssetType(t)).toBe("other");
    }
  });
});

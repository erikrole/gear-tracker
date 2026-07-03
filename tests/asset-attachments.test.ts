import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  getAttachmentCandidateBlockedReason,
  getAttachmentCandidateState,
  getAttachmentDisplayName,
  getAttachmentKind,
  getAttachmentStatusWarning,
  getSdCardSlotLabel,
  groupAttachments,
} from "@/lib/asset-attachments";

describe("asset attachment helpers", () => {
  it("classifies camera-tied SD cards separately from rig parts", () => {
    expect(getAttachmentKind({ assetTag: "MBB 17 IV 1A", type: "SD Card" })).toBe("sd-card");
    expect(getAttachmentKind({ assetTag: "CAM-CAGE-1", type: "Camera Cage" })).toBe("camera-rig");
    expect(getAttachmentKind({ assetTag: "CAM-PART-1", type: "Cold shoe adapter" })).toBe("misc-part");
  });

  it("extracts camera slot labels from SD card operational tags", () => {
    expect(getSdCardSlotLabel({ assetTag: "MBB 17 IV 1A", type: "SD Card" }, "MBB 17 IV")).toBe("Camera 1, Slot A");
    expect(getSdCardSlotLabel({ assetTag: "MBB 17 IV 2-B", type: "Memory Card" }, "MBB 17 IV")).toBe("Camera 2, Slot B");
  });

  it("does not assign slot labels to non-media attachments", () => {
    expect(getSdCardSlotLabel({ assetTag: "MBB 17 IV 1A", type: "Camera Cage" }, "MBB 17 IV")).toBeNull();
  });

  it("groups attachments in day-to-day display order", () => {
    const groups = groupAttachments([
      { assetTag: "PART-1", type: "Adapter" },
      { assetTag: "MBB 17 IV 1A", type: "SD Card" },
      { assetTag: "CAGE-1", type: "Camera Cage" },
    ]);

    expect(groups.map((group) => group.key)).toEqual(["sd-card", "camera-rig", "misc-part"]);
  });

  it("classifies attachment search candidates before mutation", () => {
    const attachedIds = new Set(["child-1"]);

    expect(getAttachmentCandidateState({ id: "parent-1", assetTag: "CAM-1" }, "parent-1", attachedIds)).toBe("self");
    expect(getAttachmentCandidateState({ id: "child-1", assetTag: "SD-1" }, "parent-1", attachedIds)).toBe("already-attached");
    expect(getAttachmentCandidateState({ id: "child-2", assetTag: "SD-2", parentAssetId: "other-parent" }, "parent-1", attachedIds)).toBe("already-child");
    expect(getAttachmentCandidateState({ id: "loose-1", assetTag: "CAGE-1", parentAssetId: null }, "parent-1", attachedIds)).toBe("available");
  });

  it("explains blocked attachment candidates", () => {
    expect(getAttachmentCandidateBlockedReason("self")).toBe("This is the parent item.");
    expect(getAttachmentCandidateBlockedReason("already-attached")).toBe("Already attached to this item.");
    expect(getAttachmentCandidateBlockedReason("already-child")).toBe("Already attached to another parent.");
    expect(getAttachmentCandidateBlockedReason("available")).toBeNull();
  });

  it("warns when attaching operationally busy candidates", () => {
    expect(getAttachmentStatusWarning({ assetTag: "CAM-1", computedStatus: "CHECKED_OUT" })).toContain("checked out");
    expect(getAttachmentStatusWarning({ assetTag: "CAM-2", computedStatus: "RESERVED" })).toContain("Reserved");
    expect(getAttachmentStatusWarning({ assetTag: "CAM-3", status: "MAINTENANCE" })).toContain("maintenance");
    expect(getAttachmentStatusWarning({ assetTag: "CAM-4", computedStatus: "AVAILABLE" })).toBeNull();
  });

  it("builds stable attachment display names", () => {
    expect(getAttachmentDisplayName({ assetTag: "SD-1", name: "Angelbird 128GB" })).toBe("Angelbird 128GB");
    expect(getAttachmentDisplayName({ assetTag: "CAGE-1", brand: "SmallRig", model: "FX3 Cage" })).toBe("SmallRig FX3 Cage");
    expect(getAttachmentDisplayName({ assetTag: "PART-1", type: "Adapter" })).toBe("Adapter");
    expect(getAttachmentDisplayName({ assetTag: "ATT FX3 1 Sony XLR-H1 XLR Handle E79281F0", name: "Sony XLR-H1 XLR Handle" })).toBe("Sony XLR-H1 XLR Handle");
  });

  it("keeps generated internal tags out of attachment detail row titles", () => {
    const source = readFileSync("src/app/(app)/items/[id]/ItemSettingsTab.tsx", "utf8");

    expect(source).toContain("const displayName = getAttachmentDisplayName(acc);");
    expect(source).toContain("alt={displayName}");
    expect(source).toContain("{displayName}");
    expect(source).toContain("detachAccessory(acc.id, displayName)");
    expect(source).not.toContain("{acc.assetTag}</Link>");
  });
});

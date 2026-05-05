import { describe, expect, it } from "vitest";
import {
  getAttachmentKind,
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
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("equipment picker render split", () => {
  it("keeps the selected shelf in a render-only component", () => {
    const picker = readFileSync("src/components/EquipmentPicker.tsx", "utf8");
    const shelf = readFileSync("src/components/equipment-picker/SelectedEquipmentShelf.tsx", "utf8");

    expect(picker).toContain('import { SelectedEquipmentShelf } from "@/components/equipment-picker/SelectedEquipmentShelf"');
    expect(picker).toContain("<SelectedEquipmentShelf");
    expect(picker).toContain("onRemoveAsset={(id) => toggleAsset(id)}");
    expect(picker).toContain("onRemoveBulk={(id) => setBulkQty(id, 0)}");

    expect(shelf).toContain("export function SelectedEquipmentShelf");
    expect(shelf).not.toContain("useState");
    expect(shelf).not.toContain("useEffect");
    expect(shelf).not.toContain("fetch(");
    expect(shelf).not.toContain("useConflictCheck");
    expect(shelf).not.toContain("usePickerSearch");
  });
});

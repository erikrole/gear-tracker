import { describe, expect, it } from "vitest";
import {
  buildSerializedItemSubmitBody,
  UNKNOWN_ITEM_METADATA,
} from "@/app/(app)/items/new-item-sheet/serialized-submit";

const baseInput = {
  assetTag: " CAM-A-01 ",
  itemName: "",
  brand: "",
  model: "",
  serialNumber: "",
  qrCodeValue: " QR-CAM-A-01 ",
  locationId: "cmlocation000000000000001",
  categoryId: "cmcategory000000000000001",
  departmentId: "",
  purchaseDate: "",
  purchasePrice: "",
  warrantyDate: "",
  residualValue: "",
  linkUrl: "",
  uwAssetTag: "",
  fiscalYear: "",
  userNotes: "",
  availableForReservation: true,
  availableForCheckout: true,
  availableForCustody: true,
  isAccessory: false,
};

describe("manual Standard item intake payload", () => {
  it("allows fast intake without name, brand, model, or department", () => {
    const body = buildSerializedItemSubmitBody(baseInput);

    expect(body).toMatchObject({
      assetTag: "CAM-A-01",
      type: "equipment",
      brand: UNKNOWN_ITEM_METADATA,
      model: UNKNOWN_ITEM_METADATA,
      qrCodeValue: "QR-CAM-A-01",
      locationId: "cmlocation000000000000001",
      categoryId: "cmcategory000000000000001",
      availableForReservation: true,
      availableForCheckout: true,
      availableForCustody: true,
    });
    expect(body).not.toHaveProperty("name");
    expect(body).not.toHaveProperty("departmentId");
  });

  it("preserves optional metadata when operators have it during intake", () => {
    const body = buildSerializedItemSubmitBody({
      ...baseInput,
      itemName: "Sony FX6 body",
      brand: " Sony ",
      model: " FX6 ",
      serialNumber: " SN-123 ",
      departmentId: "cmdepartment000000000001",
      linkUrl: " https://example.com/fx6 ",
      fiscalYear: "FY26",
      userNotes: " Includes cage ",
    });

    expect(body).toMatchObject({
      name: "Sony FX6 body",
      brand: "Sony",
      model: "FX6",
      serialNumber: "SN-123",
      departmentId: "cmdepartment000000000001",
      linkUrl: "https://example.com/fx6",
      notes: JSON.stringify({ fiscalYear: "FY26", userNotes: "Includes cage" }),
    });
  });

  it("keeps attachment policy restrictions when a standard item is a parented accessory", () => {
    const body = buildSerializedItemSubmitBody({
      ...baseInput,
      isAccessory: true,
      parentAssetId: "cmparentasset000000000001",
    });

    expect(body).toMatchObject({
      parentAssetId: "cmparentasset000000000001",
      availableForReservation: false,
      availableForCheckout: false,
      availableForCustody: false,
    });
  });
});

import { describe, expect, it } from "vitest";
import { ResourceType } from "@prisma/client";
import {
  defaultCategoryForResourceType,
  inferResourceTypeFromCategory,
  RESOURCE_TYPE_OPTIONS,
} from "@/lib/guide-categories";
import { createGuideSchema, updateGuideSchema } from "@/lib/validation";

describe("resource typed contract", () => {
  it("infers typed resource modules from legacy categories", () => {
    expect(inferResourceTypeFromCategory("Contacts")).toBe(ResourceType.CONTACTS);
    expect(inferResourceTypeFromCategory("building numbers")).toBe(ResourceType.BUILDING_NUMBERS);
    expect(inferResourceTypeFromCategory("Media Drive")).toBe(ResourceType.MEDIA_DRIVE);
    expect(inferResourceTypeFromCategory("Server Paths")).toBe(ResourceType.SERVER_PATHS);
    expect(inferResourceTypeFromCategory("SOPs")).toBe(ResourceType.SOP);
    expect(inferResourceTypeFromCategory("How to")).toBe(ResourceType.HOW_TO);
    expect(inferResourceTypeFromCategory("Troubleshooting")).toBe(ResourceType.TROUBLESHOOTING);
    expect(inferResourceTypeFromCategory("Account Notes")).toBe(ResourceType.ACCOUNT_NOTE);
    expect(inferResourceTypeFromCategory("Event Operations")).toBe(ResourceType.EVENT_OPS);
    expect(inferResourceTypeFromCategory("Something Else")).toBe(ResourceType.GENERAL);
  });

  it("keeps resource type defaults stable for authoring", () => {
    expect(RESOURCE_TYPE_OPTIONS).toContain(ResourceType.CONTACTS);
    expect(defaultCategoryForResourceType(ResourceType.MEDIA_DRIVE)).toBe("Media Drive");
    expect(defaultCategoryForResourceType(ResourceType.GENERAL)).toBe("General Info");
  });

  it("validates create and update payloads with typed resource modules", () => {
    expect(createGuideSchema.parse({
      title: "Server paths",
      type: ResourceType.SERVER_PATHS,
      category: "Server Paths",
    }).type).toBe(ResourceType.SERVER_PATHS);

    expect(createGuideSchema.parse({
      title: "General note",
      category: "General Info",
    }).type).toBe(ResourceType.GENERAL);

    expect(updateGuideSchema.parse({
      type: ResourceType.CONTACTS,
    }).type).toBe(ResourceType.CONTACTS);
  });
});

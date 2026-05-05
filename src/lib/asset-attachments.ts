export type AttachmentKind = "sd-card" | "camera-rig" | "misc-part";

export type AttachmentLike = {
  assetTag: string;
  name?: string | null;
  type?: string | null;
  brand?: string | null;
  model?: string | null;
};

export type AttachmentGroup = {
  key: AttachmentKind;
  label: string;
  description: string;
  items: AttachmentLike[];
};

const SD_CARD_TERMS = [
  "sd card",
  "sdcard",
  "micro sd",
  "microsd",
  "memory card",
  "media card",
  "cfexpress",
  "cfast",
  "xqd",
];

const CAMERA_RIG_TERMS = [
  "cage",
  "rig",
  "handle",
  "top handle",
  "side handle",
  "plate",
  "baseplate",
  "mount",
  "bracket",
  "rail",
  "rod",
];

function searchableText(item: AttachmentLike): string {
  return [item.type, item.name, item.brand, item.model, item.assetTag]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function getAttachmentKind(item: AttachmentLike): AttachmentKind {
  const text = searchableText(item);
  if (SD_CARD_TERMS.some((term) => text.includes(term))) return "sd-card";
  if (CAMERA_RIG_TERMS.some((term) => text.includes(term))) return "camera-rig";
  return "misc-part";
}

export function getAttachmentKindLabel(kind: AttachmentKind): string {
  switch (kind) {
    case "sd-card":
      return "SD Cards";
    case "camera-rig":
      return "Cages and Rigging";
    case "misc-part":
      return "Misc Parts";
  }
}

export function getAttachmentKindDescription(kind: AttachmentKind): string {
  switch (kind) {
    case "sd-card":
      return "Camera-slot media that stays tied to this camera.";
    case "camera-rig":
      return "Cages, handles, plates, and fixed camera hardware.";
    case "misc-part":
      return "Other tracked parts that travel with this camera.";
  }
}

export function groupAttachments<T extends AttachmentLike>(
  items: T[],
): Array<Omit<AttachmentGroup, "items"> & { items: T[] }> {
  const order: AttachmentKind[] = ["sd-card", "camera-rig", "misc-part"];
  return order
    .map((kind) => ({
      key: kind,
      label: getAttachmentKindLabel(kind),
      description: getAttachmentKindDescription(kind),
      items: items.filter((item) => getAttachmentKind(item) === kind),
    }))
    .filter((group) => group.items.length > 0);
}

export function getSdCardSlotLabel(item: AttachmentLike, parentAssetTag?: string | null): string | null {
  if (getAttachmentKind(item) !== "sd-card") return null;
  const tag = item.assetTag.trim();
  const suffix = parentAssetTag && tag.toLowerCase().startsWith(parentAssetTag.toLowerCase())
    ? tag.slice(parentAssetTag.length).trim()
    : tag.split(/\s+/).at(-1) ?? "";
  const match = suffix.match(/^(\d+)\s*[-_ ]?\s*([A-Za-z])$/);
  if (!match) return null;
  const cameraNumber = match[1];
  const slot = match[2];
  if (!cameraNumber || !slot) return null;
  return `Camera ${cameraNumber}, Slot ${slot.toUpperCase()}`;
}

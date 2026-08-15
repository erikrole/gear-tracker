import { createHash } from "node:crypto";
import sharp from "sharp";
import { computeSignatureCropBounds, normalizeSignatureStrokes, signaturePathData } from "./geometry";
import { penSettingsSchema, type SignaturePenSettings, type SignatureStroke } from "./types";

export type SignatureArtifactBundle = {
  svg: string;
  png: Buffer;
  pngHash: string;
  svgHash: string;
  width: number;
  height: number;
  cropBounds: ReturnType<typeof computeSignatureCropBounds>;
};

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

export function buildSignatureSvg(
  strokes: SignatureStroke[],
  settingsInput: SignaturePenSettings,
): { svg: string; width: number; height: number; cropBounds: ReturnType<typeof computeSignatureCropBounds> } {
  const settings = penSettingsSchema.parse(settingsInput);
  const normalized = normalizeSignatureStrokes(strokes);
  const cropBounds = computeSignatureCropBounds(normalized, settings);
  const paths = normalized
    .map((stroke) => `<path d="${signaturePathData(stroke, cropBounds)}"/>`)
    .join("");

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${cropBounds.width}" height="${cropBounds.height}" viewBox="0 0 ${cropBounds.width} ${cropBounds.height}">`,
    `<g fill="none" stroke="${escapeAttribute(settings.strokeColor)}" stroke-width="${settings.strokeWidth}" stroke-linecap="round" stroke-linejoin="round">`,
    paths,
    "</g>",
    "</svg>",
  ].join("");

  return { svg, width: cropBounds.width, height: cropBounds.height, cropBounds };
}

export async function renderSignatureArtifacts(
  strokes: SignatureStroke[],
  settings: SignaturePenSettings,
): Promise<SignatureArtifactBundle> {
  const source = buildSignatureSvg(strokes, settings);
  const png = await sharp(Buffer.from(source.svg, "utf8"), { density: 72 })
    .png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
    .toBuffer();
  return {
    ...source,
    png,
    pngHash: createHash("sha256").update(png).digest("hex"),
    svgHash: createHash("sha256").update(source.svg, "utf8").digest("hex"),
  };
}

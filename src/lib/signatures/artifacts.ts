import { createHash } from "node:crypto";
import sharp from "sharp";
import { computeSignatureCropBounds, normalizeSignatureStrokes, removeAccidentalSignatureStrokes, signaturePathData } from "./geometry";
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

export const SIGNATURE_PNG_MIN_WIDTH = 1_000;

type RenderedSignaturePng = {
  png: Buffer;
  width: number;
  height: number;
};

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

export function buildSignatureSvg(
  strokes: SignatureStroke[],
  settingsInput: SignaturePenSettings,
): { svg: string; width: number; height: number; cropBounds: ReturnType<typeof computeSignatureCropBounds> } {
  const settings = penSettingsSchema.parse(settingsInput);
  const normalized = removeAccidentalSignatureStrokes(normalizeSignatureStrokes(strokes), settings);
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

export async function renderSignaturePngFromSvg(
  svg: string,
  limits: Pick<SignaturePenSettings, "maxWidth" | "maxHeight"> = { maxWidth: 1_600, maxHeight: 900 },
): Promise<RenderedSignaturePng> {
  const rasterized = await sharp(Buffer.from(svg, "utf8"), { density: 144 })
    .resize({
      width: limits.maxWidth,
      height: limits.maxHeight,
      fit: "inside",
      withoutEnlargement: false,
    })
    .png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
    .toBuffer({ resolveWithObject: true });

  if (rasterized.info.width >= SIGNATURE_PNG_MIN_WIDTH) {
    return {
      png: rasterized.data,
      width: rasterized.info.width,
      height: rasterized.info.height,
    };
  }

  const missingWidth = SIGNATURE_PNG_MIN_WIDTH - rasterized.info.width;
  const left = Math.floor(missingWidth / 2);
  const right = missingWidth - left;
  const padded = await sharp(rasterized.data)
    .extend({
      left,
      right,
      top: 0,
      bottom: 0,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
    .toBuffer({ resolveWithObject: true });

  return {
    png: padded.data,
    width: padded.info.width,
    height: padded.info.height,
  };
}

export async function renderSignatureArtifacts(
  strokes: SignatureStroke[],
  settings: SignaturePenSettings,
): Promise<SignatureArtifactBundle> {
  const source = buildSignatureSvg(strokes, settings);
  const renderedPng = await renderSignaturePngFromSvg(source.svg, settings);
  return {
    ...source,
    png: renderedPng.png,
    width: renderedPng.width,
    height: renderedPng.height,
    pngHash: createHash("sha256").update(renderedPng.png).digest("hex"),
    svgHash: createHash("sha256").update(source.svg, "utf8").digest("hex"),
  };
}

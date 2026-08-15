import {
  SIGNATURE_MAX_COORDINATE,
  SIGNATURE_MAX_POINTS_PER_STROKE,
  SIGNATURE_MAX_STROKES,
  type SignaturePenSettings,
  type SignatureStroke,
} from "./types";

export type SignatureCropBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function normalizeSignatureStrokes(
  strokes: SignatureStroke[],
): SignatureStroke[] {
  if (strokes.length < 1 || strokes.length > SIGNATURE_MAX_STROKES) {
    throw new Error("Signature must contain between 1 and 32 strokes");
  }

  return strokes.map((stroke) => {
    if (stroke.points.length < 1 || stroke.points.length > SIGNATURE_MAX_POINTS_PER_STROKE) {
      throw new Error("Signature stroke has an invalid point count");
    }
    return {
      points: stroke.points.map((point) => {
        if (
          !Number.isFinite(point.x) ||
          !Number.isFinite(point.y) ||
          point.x < 0 ||
          point.y < 0 ||
          point.x > SIGNATURE_MAX_COORDINATE ||
          point.y > SIGNATURE_MAX_COORDINATE
        ) {
          throw new Error("Signature coordinates are outside the allowed canvas");
        }
        return { x: Number(point.x.toFixed(3)), y: Number(point.y.toFixed(3)) };
      }),
    };
  });
}

export function computeSignatureCropBounds(
  strokes: SignatureStroke[],
  settings: SignaturePenSettings,
): SignatureCropBounds {
  const points = strokes.flatMap((stroke) => stroke.points);
  if (points.length === 0) throw new Error("Signature has no points");

  const radius = settings.strokeWidth / 2;
  const minX = Math.floor(Math.min(...points.map((point) => point.x)) - radius - settings.cropPadding);
  const minY = Math.floor(Math.min(...points.map((point) => point.y)) - radius - settings.cropPadding);
  const maxX = Math.ceil(Math.max(...points.map((point) => point.x)) + radius + settings.cropPadding);
  const maxY = Math.ceil(Math.max(...points.map((point) => point.y)) + radius + settings.cropPadding);
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);

  if (width > settings.maxWidth || height > settings.maxHeight) {
    throw new Error("Signature exceeds the configured crop dimensions");
  }

  return { x: minX, y: minY, width, height };
}

export function formatSignatureNumber(value: number): string {
  return Number(value.toFixed(3)).toString();
}

export function signaturePathData(
  stroke: SignatureStroke,
  crop: SignatureCropBounds,
): string {
  const [first, ...rest] = stroke.points;
  if (!first) throw new Error("Signature stroke has no first point");
  const commands = [`M ${formatSignatureNumber(first.x - crop.x)} ${formatSignatureNumber(first.y - crop.y)}`];
  if (rest.length === 0) {
    // A Pencil tap is still ink. A round-capped zero-length path is rendered
    // consistently by Sharp and preserves the configured stroke width.
    commands.push(`L ${formatSignatureNumber(first.x - crop.x)} ${formatSignatureNumber(first.y - crop.y)}`);
  }
  for (const point of rest) {
    commands.push(`L ${formatSignatureNumber(point.x - crop.x)} ${formatSignatureNumber(point.y - crop.y)}`);
  }
  return commands.join(" ");
}

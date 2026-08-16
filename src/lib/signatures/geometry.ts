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

export type SignaturePoint = { x: number; y: number };

export type SignatureCurveSegment =
  | { type: "L"; to: SignaturePoint }
  | { type: "Q"; control: SignaturePoint; to: SignaturePoint };

export type SignatureCurve = {
  start: SignaturePoint;
  segments: SignatureCurveSegment[];
};

/**
 * Builds the shared display/artifact curve for a normalized stroke. Midpoints
 * keep the curve close to the Pencil path while removing the visible corners
 * produced by drawing every coalesced point as an independent line segment.
 */
export function buildSignatureCurve(points: readonly SignaturePoint[]): SignatureCurve {
  const [start, ...rest] = points;
  if (!start) throw new Error("Signature stroke has no first point");
  if (rest.length === 0) return { start, segments: [{ type: "L", to: start }] };
  if (rest.length === 1) return { start, segments: [{ type: "L", to: rest[0]! }] };

  const segments: SignatureCurveSegment[] = [];
  for (let index = 1; index < points.length - 1; index += 1) {
    const control = points[index]!;
    const next = points[index + 1]!;
    segments.push({
      type: "Q",
      control,
      to: { x: (control.x + next.x) / 2, y: (control.y + next.y) / 2 },
    });
  }
  const last = points.at(-1)!;
  segments.push({ type: "Q", control: last, to: last });
  return { start, segments };
}

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
  const curve = buildSignatureCurve(stroke.points);
  const point = (value: SignaturePoint) => `${formatSignatureNumber(value.x - crop.x)} ${formatSignatureNumber(value.y - crop.y)}`;
  const commands = [`M ${point(curve.start)}`];
  for (const segment of curve.segments) {
    if (segment.type === "L") {
      commands.push(`L ${point(segment.to)}`);
    } else {
      commands.push(`Q ${point(segment.control)} ${point(segment.to)}`);
    }
  }
  return commands.join(" ");
}

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Color = {
  red: number;
  green: number;
  blue: number;
  alpha: number;
};

const css = readFileSync("src/app/globals.css", "utf8");
const lightTheme = themeBlock(/:root,\s*\[data-theme="light"\]\s*\{([\s\S]*?)\n\}/);
const darkTheme = themeBlock(/\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/);

const variants = ["green", "blue", "purple", "red", "orange"] as const;
const darkUnderlays = ["bg", "bg-card", "bg-elevated"] as const;
const reportChartTokens = Array.from({ length: 8 }, (_, index) => `report-chart-${index + 1}`);
const overdueChartTokens = Array.from({ length: 10 }, (_, index) => `report-overdue-${index + 1}`);
const heatmapTokens = Array.from({ length: 5 }, (_, index) => `heatmap-${index + 1}`);
const chartSurfaces = ["bg", "bg-card", "bg-elevated"] as const;

function themeBlock(pattern: RegExp): string {
  const match = css.match(pattern);
  if (!match) throw new Error(`Could not find theme block matching ${pattern}`);
  return match[1]!;
}

function token(block: string, name: string): string {
  const match = block.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!match) throw new Error(`Could not find --${name}`);
  return match[1]!.trim();
}

function parseColor(value: string): Color {
  if (/^#[0-9a-f]{6}$/i.test(value)) {
    return {
      red: Number.parseInt(value.slice(1, 3), 16) / 255,
      green: Number.parseInt(value.slice(3, 5), 16) / 255,
      blue: Number.parseInt(value.slice(5, 7), 16) / 255,
      alpha: 1,
    };
  }

  const rgba = value.match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/i);
  if (rgba) {
    return {
      red: Number(rgba[1]) / 255,
      green: Number(rgba[2]) / 255,
      blue: Number(rgba[3]) / 255,
      alpha: Number(rgba[4]),
    };
  }

  const oklch = value.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/i);
  if (oklch) {
    return oklchToSrgb(Number(oklch[1]), Number(oklch[2]), Number(oklch[3]));
  }

  throw new Error(`Unsupported color value: ${value}`);
}

function oklchToSrgb(lightness: number, chroma: number, hue: number): Color {
  const radians = hue * Math.PI / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);
  const lPrime = lightness + 0.3963377774 * a + 0.2158037573 * b;
  const mPrime = lightness - 0.1055613458 * a - 0.0638541728 * b;
  const sPrime = lightness - 0.0894841775 * a - 1.291485548 * b;
  const l = lPrime ** 3;
  const m = mPrime ** 3;
  const s = sPrime ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ] as const;

  for (const channel of linear) {
    expect(channel, `oklch(${lightness} ${chroma} ${hue}) must stay in sRGB gamut`).toBeGreaterThanOrEqual(0);
    expect(channel, `oklch(${lightness} ${chroma} ${hue}) must stay in sRGB gamut`).toBeLessThanOrEqual(1);
  }

  const red = linearToSrgb(linear[0]);
  const green = linearToSrgb(linear[1]);
  const blue = linearToSrgb(linear[2]);
  return { red, green, blue, alpha: 1 };
}

function linearToSrgb(channel: number): number {
  return channel <= 0.0031308
    ? 12.92 * channel
    : 1.055 * channel ** (1 / 2.4) - 0.055;
}

function composite(foreground: Color, background: Color): Color {
  return {
    red: foreground.red * foreground.alpha + background.red * (1 - foreground.alpha),
    green: foreground.green * foreground.alpha + background.green * (1 - foreground.alpha),
    blue: foreground.blue * foreground.alpha + background.blue * (1 - foreground.alpha),
    alpha: 1,
  };
}

function contrastRatio(foreground: Color, background: Color): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(color: Color): number {
  const red = srgbToLinear(color.red);
  const green = srgbToLinear(color.green);
  const blue = srgbToLinear(color.blue);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function srgbToLinear(channel: number): number {
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

describe("semantic badge color contrast", () => {
  it("keeps every light-mode badge pair at WCAG AA contrast", () => {
    const pairs = [
      ...variants.map((variant) => ({
        variant,
        foreground: parseColor(token(lightTheme, `${variant}-text`)),
        background: parseColor(token(lightTheme, `${variant}-bg`)),
      })),
      {
        variant: "gray",
        foreground: parseColor(token(lightTheme, "text-secondary")),
        background: parseColor(token(lightTheme, "bg-surface")),
      },
    ];

    for (const pair of pairs) {
      expect(contrastRatio(pair.foreground, pair.background), pair.variant).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps every dark-mode badge pair at WCAG AA contrast on supported surfaces", () => {
    for (const underlayName of darkUnderlays) {
      const underlay = parseColor(token(darkTheme, underlayName));
      const pairs = [
        ...variants.map((variant) => ({
          variant,
          foreground: parseColor(token(darkTheme, `${variant}-text`)),
          background: composite(parseColor(token(darkTheme, `${variant}-bg`)), underlay),
        })),
        {
          variant: "gray",
          foreground: parseColor(token(darkTheme, "text-secondary")),
          background: parseColor(token(darkTheme, "bg-surface")),
        },
      ];

      for (const pair of pairs) {
        expect(contrastRatio(pair.foreground, pair.background), `${pair.variant} on --${underlayName}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

describe("report chart color contrast", () => {
  it.each([
    ["light", lightTheme],
    ["dark", darkTheme],
  ] as const)("keeps %s chart colors visible on supported surfaces", (_theme, block) => {
    for (const surfaceName of chartSurfaces) {
      const surface = parseColor(token(block, surfaceName));

      for (const colorName of [...reportChartTokens, ...overdueChartTokens, ...heatmapTokens]) {
        const color = parseColor(token(block, colorName));
        expect(contrastRatio(color, surface), `${colorName} on --${surfaceName}`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

import { describe, expect, it } from "vitest";
import { validateImage, hasValidImageMagic, isAllowedImageType, downloadImageToBlob, isBlobUrl } from "@/lib/blob";

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_MAGIC = [0xff, 0xd8, 0xff, 0xe0];
const GIF_MAGIC = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];
const WEBP_MAGIC = [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];

function fileFrom(bytes: number[], name: string, type: string): File {
  const padded = bytes.length < 12 ? [...bytes, ...new Array(12 - bytes.length).fill(0)] : bytes;
  return new File([new Uint8Array(padded)], name, { type });
}

describe("hasValidImageMagic", () => {
  it("accepts real raster signatures", async () => {
    expect(await hasValidImageMagic(fileFrom(PNG_MAGIC, "a.png", "image/png"))).toBe(true);
    expect(await hasValidImageMagic(fileFrom(JPEG_MAGIC, "a.jpg", "image/jpeg"))).toBe(true);
    expect(await hasValidImageMagic(fileFrom(GIF_MAGIC, "a.gif", "image/gif"))).toBe(true);
    expect(await hasValidImageMagic(fileFrom(WEBP_MAGIC, "a.webp", "image/webp"))).toBe(true);
  });

  it("rejects HTML/script smuggled under an image mime", async () => {
    const html = Array.from("<script>alert(1)</script>").map((c) => c.charCodeAt(0));
    expect(await hasValidImageMagic(fileFrom(html, "evil.png", "image/png"))).toBe(false);
  });

  it("rejects an SVG payload", async () => {
    const svg = Array.from("<svg xmlns=").map((c) => c.charCodeAt(0));
    expect(await hasValidImageMagic(fileFrom(svg, "evil.svg", "image/png"))).toBe(false);
  });
});

describe("validateImage", () => {
  it("passes a well-formed PNG", async () => {
    expect(await validateImage(fileFrom(PNG_MAGIC, "ok.png", "image/png"))).toBeNull();
  });

  it("rejects a disallowed mime even with valid bytes", async () => {
    expect(await validateImage(fileFrom(PNG_MAGIC, "x.svg", "image/svg+xml"))).toMatch(/JPEG, PNG/);
  });

  it("rejects an allowed mime whose bytes are not an image", async () => {
    const html = Array.from("<!DOCTYPE html>").map((c) => c.charCodeAt(0));
    expect(await validateImage(fileFrom(html, "fake.png", "image/png"))).toMatch(/not a valid image/);
  });
});

describe("isAllowedImageType", () => {
  it("allows raster types and rejects svg", () => {
    expect(isAllowedImageType("image/png")).toBe(true);
    expect(isAllowedImageType("image/svg+xml")).toBe(false);
    expect(isAllowedImageType("text/html")).toBe(false);
  });
});

describe("downloadImageToBlob SSRF guard (pre-DNS rejections)", () => {
  it("rejects non-http(s) schemes without fetching", async () => {
    expect(await downloadImageToBlob("file:///etc/passwd", "a1")).toBeNull();
    expect(await downloadImageToBlob("data:text/html,<script>", "a1")).toBeNull();
    expect(await downloadImageToBlob("gopher://internal/", "a1")).toBeNull();
  });

  it("rejects malformed URLs", async () => {
    expect(await downloadImageToBlob("not a url", "a1")).toBeNull();
  });

  it("passes through already-hosted blob URLs untouched", async () => {
    const url = "https://x.public.blob.vercel-storage.com/avatars/a.png";
    expect(isBlobUrl(url)).toBe(true);
    expect(await downloadImageToBlob(url, "a1")).toBe(url);
  });
});

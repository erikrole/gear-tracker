import { describe, expect, it } from "vitest";
import { BH_HERO_IMAGE_SIZE, toBhStaticImageUrl } from "@/lib/bhphoto-image";

const WRAPPED_URL =
  "https://www.bhphotovideo.com/cdn-cgi/image/fit=scale-down,width=500,quality=95/https://www.bhphotovideo.com/images/images500x500/sony_a7_iv_mirrorless_camera_1722271225_1681602.jpg";
const STATIC_500 =
  "https://static.bhphoto.com/images/images500x500/sony_a7_iv_mirrorless_camera_1722271225_1681602.jpg";

describe("toBhStaticImageUrl", () => {
  it("unwraps Cloudflare cdn-cgi URLs to the static host, preserving size", () => {
    expect(toBhStaticImageUrl(WRAPPED_URL)).toBe(STATIC_500);
  });

  it("rewrites to a requested square size", () => {
    expect(toBhStaticImageUrl(WRAPPED_URL, BH_HERO_IMAGE_SIZE)).toBe(
      "https://static.bhphoto.com/images/images1000x1000/sony_a7_iv_mirrorless_camera_1722271225_1681602.jpg",
    );
  });

  it("rewrites direct bhphotovideo.com image URLs", () => {
    expect(
      toBhStaticImageUrl("https://www.bhphotovideo.com/images/images500x500/camera_123.jpg"),
    ).toBe("https://static.bhphoto.com/images/images500x500/camera_123.jpg");
  });

  it("is idempotent for static.bhphoto.com URLs", () => {
    expect(toBhStaticImageUrl(STATIC_500)).toBe(STATIC_500);
  });

  it("returns null for non-B&H hosts, even with a matching path", () => {
    expect(toBhStaticImageUrl("https://images.example/images/images500x500/camera.jpg")).toBeNull();
    expect(toBhStaticImageUrl("https://notbhphotovideo.com/images/images500x500/camera.jpg")).toBeNull();
  });

  it("returns null for B&H URLs that are not product images", () => {
    expect(toBhStaticImageUrl("https://www.bhphotovideo.com/c/product/1234-REG/camera.html")).toBeNull();
  });

  it("returns null for malformed or non-http URLs", () => {
    expect(toBhStaticImageUrl("not a url")).toBeNull();
    expect(toBhStaticImageUrl("ftp://static.bhphoto.com/images/images500x500/camera.jpg")).toBeNull();
  });
});

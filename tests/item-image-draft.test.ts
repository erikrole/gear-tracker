import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildItemImageSearchSeed,
  persistDraftItemImage,
} from "@/lib/item-image-draft";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Add item draft images", () => {
  it("builds a useful product search seed without repeating metadata", () => {
    expect(buildItemImageSearchSeed("Sony FX3", "Sony", "FX3", "CAM 1")).toBe("Sony FX3");
    expect(buildItemImageSearchSeed("", "Canon", "R5", "CAM 2")).toBe("Canon R5");
    expect(buildItemImageSearchSeed("", "", "", "CAM 3")).toBe("CAM 3");
  });

  it("uploads staged files with the image route's required file field", async () => {
    const file = new File(["image"], "camera.jpg", { type: "image/jpeg" });
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      expect(init?.body).toBeInstanceOf(FormData);
      expect((init?.body as FormData).get("file")).toBe(file);
      expect((init?.body as FormData).get("image")).toBeNull();
      return new Response(JSON.stringify({ imageUrl: "https://blob.example/camera.jpg" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(persistDraftItemImage("/api/assets/asset-1/image", {
      kind: "file",
      file,
      previewUrl: "data:image/jpeg;base64,aW1hZ2U=",
    })).resolves.toBe("https://blob.example/camera.jpg");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/assets/asset-1/image");
  });

  it("retries a staged search result with its thumbnail fallback", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "Blocked image" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        imageUrl: "https://blob.example/fallback.jpg",
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(persistDraftItemImage("/api/bulk-skus/sku-1/image", {
      kind: "remote",
      url: "https://vendor.example/full.jpg",
      fallbackUrl: "https://vendor.example/thumb.jpg",
      previewUrl: "https://vendor.example/thumb.jpg",
    })).resolves.toBe("https://blob.example/fallback.jpg");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      url: "https://vendor.example/full.jpg",
    });
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({
      url: "https://vendor.example/thumb.jpg",
    });
  });
});

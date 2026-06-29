import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(relativeFile: string) {
  return readFileSync(path.join(process.cwd(), relativeFile), "utf8");
}

describe("iOS runtime warning cleanup", () => {
  it("keeps native URLSession clients on explicit mobile timeouts without multipath fallback", () => {
    for (const file of [
      "ios/Wisconsin/Core/APIClient.swift",
      "ios/Wisconsin/Core/ThumbnailLoader.swift",
    ]) {
      const swift = source(file);

      expect(swift).toContain("config.waitsForConnectivity = false");
      expect(swift).toContain("config.timeoutIntervalForRequest = 15");
      expect(swift).toContain("config.timeoutIntervalForResource = 30");
      expect(swift).toContain("config.multipathServiceType = .none");
    }

    const kiosk = source("ios/Wisconsin/Kiosk/KioskAPIClient.swift");
    expect(kiosk).toContain("config.waitsForConnectivity = true");
    expect(kiosk).toContain("config.timeoutIntervalForRequest = 15");
    expect(kiosk).toContain("config.timeoutIntervalForResource = 30");
    expect(kiosk).toContain("config.multipathServiceType = .none");
  });

  it("uses a bounded URL cache for remote thumbnails without replacing decoded image caching", () => {
    const thumbnails = source("ios/Wisconsin/Core/ThumbnailLoader.swift");

    expect(thumbnails).toContain("private let thumbnailURLCache = URLCache(");
    expect(thumbnails).toContain('diskPath: "WisconsinThumbnailURLCache"');
    expect(thumbnails).toContain("config.urlCache = thumbnailURLCache");
    expect(thumbnails).toContain("config.requestCachePolicy = .returnCacheDataElseLoad");
    expect(thumbnails).toContain("request.cachePolicy = .returnCacheDataElseLoad");
    expect(thumbnails).toContain("ThumbnailCache.shared.image(for: cacheKey)");
    expect(thumbnails).toContain("ThumbnailCache.shared.store(image, for: cacheKey)");
  });

  it("does not restart VisionKit behind the Scan result sheet", () => {
    const scanView = source("ios/Wisconsin/Views/ScanView.swift");
    const resultBranch = scanView.slice(
      scanView.indexOf("let outcome = try await SearchService.shared.search"),
      scanView.indexOf("} catch {", scanView.indexOf("let outcome = try await SearchService.shared.search")),
    );
    const catchBranch = scanView.slice(
      scanView.indexOf("} catch {", scanView.indexOf("let outcome = try await SearchService.shared.search")),
      scanView.indexOf("private func retryLastScan()"),
    );

    expect(resultBranch).toContain("Keep VisionKit stopped while the result sheet presents");
    const sheetBranch = resultBranch.slice(resultBranch.indexOf("results = outcome"));

    expect(sheetBranch).toContain("results = outcome");
    expect(sheetBranch).not.toContain("isScanning = true");
    expect(catchBranch).toContain("resultError = message");
    expect(catchBranch).not.toContain("isScanning = true");
  });
});

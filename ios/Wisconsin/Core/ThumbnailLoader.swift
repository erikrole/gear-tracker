import SwiftUI
import UIKit
import ImageIO

// Downsamples image data to a target pixel size using ImageIO (no full-res decode).
private func downsample(data: Data, maxPixels: CGFloat, scale: CGFloat) -> UIImage? {
    let sourceOptions: [CFString: Any] = [kCGImageSourceShouldCache: false]
    guard let source = CGImageSourceCreateWithData(data as CFData, sourceOptions as CFDictionary) else { return nil }
    let thumbOptions: [CFString: Any] = [
        kCGImageSourceCreateThumbnailFromImageAlways: true,
        kCGImageSourceShouldCacheImmediately: true,
        kCGImageSourceCreateThumbnailWithTransform: true,
        kCGImageSourceThumbnailMaxPixelSize: maxPixels
    ]
    guard let cgImage = CGImageSourceCreateThumbnailAtIndex(source, 0, thumbOptions as CFDictionary) else { return nil }
    return UIImage(cgImage: cgImage, scale: scale, orientation: .up)
}

// NSCache-backed thumbnail store. Limited to 20 MB of decoded pixel data.
@MainActor
final class ThumbnailCache {
    static let shared = ThumbnailCache()
    private let cache = NSCache<NSString, UIImage>()

    private init() {
        cache.totalCostLimit = 20_000_000
        cache.countLimit = 150
    }

    func image(for key: String) -> UIImage? {
        cache.object(forKey: key as NSString)
    }

    func store(_ image: UIImage, for key: String) {
        let cost = Int(image.size.width * image.size.height * image.scale * image.scale * 4)
        cache.setObject(image, forKey: key as NSString, cost: cost)
    }

    func evictAll() {
        cache.removeAllObjects()
    }
}

// Dedicated session that skips URLCache so raw image Data isn't double-stored
// alongside the decoded UIImage already held in ThumbnailCache.
private let thumbnailSession: URLSession = {
    let config = URLSessionConfiguration.default
    config.urlCache = nil
    return URLSession(configuration: config)
}()

// Drop-in replacement for AsyncImage that downsamples to the actual display size.
struct CachedThumbnail: View {
    let url: URL
    let size: CGFloat

    @Environment(\.displayScale) private var displayScale
    @State private var uiImage: UIImage?
    @State private var loadTask: Task<Void, Never>?

    private var cacheKey: String { "\(url.absoluteString)@\(Int(size))" }

    var body: some View {
        Group {
            if let uiImage {
                Image(uiImage: uiImage)
                    .resizable()
                    .scaledToFill()
            } else {
                Color.clear
            }
        }
        .task(id: url) {
            loadTask?.cancel()
            loadTask = Task { await load(scale: displayScale) }
            await loadTask?.value
        }
        .onDisappear {
            loadTask?.cancel()
            loadTask = nil
        }
    }

    private func load(scale: CGFloat) async {
        if let cached = ThumbnailCache.shared.image(for: cacheKey) {
            uiImage = cached
            return
        }
        guard let (data, _) = try? await thumbnailSession.data(from: url),
              !Task.isCancelled else { return }
        let pixels = size * scale
        guard pixels > 0,
              let image = downsample(data: data, maxPixels: pixels, scale: scale),
              !Task.isCancelled else { return }
        ThumbnailCache.shared.store(image, for: cacheKey)
        uiImage = image
    }
}

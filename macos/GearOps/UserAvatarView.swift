import AppKit
import ImageIO
import SwiftUI

private let avatarURLCache = URLCache(
    memoryCapacity: 2_000_000,
    diskCapacity: 20_000_000,
    diskPath: "GearOpsAvatarURLCache"
)

private let avatarSession: URLSession = {
    let configuration = URLSessionConfiguration.default
    configuration.urlCache = avatarURLCache
    configuration.requestCachePolicy = .returnCacheDataElseLoad
    configuration.waitsForConnectivity = false
    configuration.timeoutIntervalForRequest = 15
    configuration.timeoutIntervalForResource = 30
    return URLSession(configuration: configuration)
}()

private enum AvatarImageProcessor {
    @concurrent
    static func thumbnail(url: URL, maxPixels: CGFloat) async -> CGImage? {
        var request = URLRequest(url: url)
        request.cachePolicy = .returnCacheDataElseLoad

        guard let (data, response) = try? await avatarSession.data(for: request),
              !Task.isCancelled,
              let http = response as? HTTPURLResponse,
              (200...299).contains(http.statusCode),
              data.count <= 10_000_000 else {
            return nil
        }

        let sourceOptions: [CFString: Any] = [kCGImageSourceShouldCache: false]
        guard let source = CGImageSourceCreateWithData(data as CFData, sourceOptions as CFDictionary) else {
            return nil
        }

        let thumbnailOptions: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceShouldCacheImmediately: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixels,
        ]
        return CGImageSourceCreateThumbnailAtIndex(source, 0, thumbnailOptions as CFDictionary)
    }
}

@MainActor
private final class AvatarImageCache {
    static let shared = AvatarImageCache()

    private let images = NSCache<NSString, NSImage>()

    private init() {
        images.countLimit = 100
        images.totalCostLimit = 8_000_000
    }

    func image(for key: String) -> NSImage? {
        images.object(forKey: key as NSString)
    }

    func store(_ image: NSImage, for key: String, pixelSize: CGFloat) {
        let cost = Int(pixelSize * pixelSize * 4)
        images.setObject(image, forKey: key as NSString, cost: cost)
    }
}

private struct CachedAvatarThumbnail: View {
    let url: URL
    let size: CGFloat

    @Environment(\.displayScale) private var displayScale
    @State private var image: NSImage?

    private var cacheKey: String { "\(url.absoluteString)@\(Int(size * displayScale))" }

    var body: some View {
        Group {
            if let image {
                Image(nsImage: image)
                    .resizable()
                    .scaledToFill()
                    .transition(.opacity)
            } else {
                Color.clear
            }
        }
        .task(id: cacheKey) {
            if let cached = AvatarImageCache.shared.image(for: cacheKey) {
                image = cached
                return
            }

            image = nil
            let pixels = max(1, size * displayScale)
            guard let cgImage = await AvatarImageProcessor.thumbnail(url: url, maxPixels: pixels),
                  !Task.isCancelled else {
                return
            }

            let thumbnail = NSImage(cgImage: cgImage, size: NSSize(width: size, height: size))
            AvatarImageCache.shared.store(thumbnail, for: cacheKey, pixelSize: pixels)
            image = thumbnail
        }
        .animation(.easeOut(duration: 0.12), value: image != nil)
    }
}

/// Compact profile image with an initials fallback for booking list rows.
struct UserAvatarView: View {
    let name: String
    let avatarUrl: String?
    var size: CGFloat = 34

    var body: some View {
        ZStack {
            initialsCircle

            if let avatarURL {
                CachedAvatarThumbnail(url: avatarURL, size: size)
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .overlay {
            Circle()
                .strokeBorder(Color.primary.opacity(0.1), lineWidth: 0.5)
        }
        .accessibilityHidden(true)
    }

    private var initialsCircle: some View {
        ZStack {
            Circle()
                .fill(.quaternary)
            Text(initials.isEmpty ? "?" : initials)
                .font(.system(size: max(size * 0.36, 9), weight: .semibold))
                .foregroundStyle(.secondary)
        }
    }

    private var initials: String {
        name
            .split(separator: " ")
            .prefix(2)
            .compactMap(\.first)
            .map(String.init)
            .joined()
            .uppercased()
    }

    private var avatarURL: URL? {
        guard let avatarUrl,
              !avatarUrl.isEmpty,
              let url = URL(string: avatarUrl),
              let scheme = url.scheme?.lowercased(),
              scheme == "https" || scheme == "http" else {
            return nil
        }
        return url
    }
}

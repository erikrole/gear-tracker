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
    configuration.httpCookieStorage = nil
    configuration.httpShouldSetCookies = false
    configuration.urlCredentialStorage = nil
    configuration.httpMaximumConnectionsPerHost = 4
    return URLSession(configuration: configuration)
}()

private enum AvatarImageProcessor {
    private static let maxResponseBytes = 2_000_000

    @concurrent
    static func thumbnail(url: URL, maxPixels: CGFloat) async -> CGImage? {
        var request = URLRequest(url: url)
        request.cachePolicy = .returnCacheDataElseLoad

        guard let (bytes, response) = try? await avatarSession.bytes(for: request),
              !Task.isCancelled,
              let http = response as? HTTPURLResponse,
              (200...299).contains(http.statusCode),
              response.url?.scheme?.lowercased() == "https",
              response.mimeType?.lowercased().hasPrefix("image/") == true else {
            return nil
        }

        var data = Data()
        data.reserveCapacity(min(maxResponseBytes, 128_000))
        do {
            for try await byte in bytes {
                guard data.count < maxResponseBytes, !Task.isCancelled else { return nil }
                data.append(byte)
            }
        } catch {
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

    func removeAll() {
        images.removeAllObjects()
    }
}

/// Clears both decoded and on-disk requester photos when an account signs out.
/// The projection cache already leaves with the session; image bytes must follow
/// it rather than surviving as a separate private-data residue.
@MainActor
enum GearOpsAvatarCache {
    private(set) static var generation: UInt64 = 0

    static func removeAll() {
        generation &+= 1
        avatarURLCache.removeAllCachedResponses()
        AvatarImageCache.shared.removeAll()
    }
}

private struct CachedAvatarThumbnail: View {
    let url: URL
    let size: CGFloat

    @Environment(\.displayScale) private var displayScale
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
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
            let generation = GearOpsAvatarCache.generation
            if let cached = AvatarImageCache.shared.image(for: cacheKey) {
                image = cached
                return
            }

            image = nil
            let pixels = max(1, size * displayScale)
            guard let cgImage = await AvatarImageProcessor.thumbnail(url: url, maxPixels: pixels),
                  !Task.isCancelled,
                  generation == GearOpsAvatarCache.generation else {
                return
            }

            let thumbnail = NSImage(cgImage: cgImage, size: NSSize(width: size, height: size))
            guard generation == GearOpsAvatarCache.generation else { return }
            AvatarImageCache.shared.store(thumbnail, for: cacheKey, pixelSize: pixels)
            image = thumbnail
        }
        .animation(reduceMotion ? nil : .easeOut(duration: 0.12), value: image != nil)
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
              scheme == "https" else {
            return nil
        }
        return url
    }
}

import SwiftUI

// MARK: - Base shape

struct Skeleton: View {
    @State private var animating = false
    var cornerRadius: CGFloat = 6

    var body: some View {
        RoundedRectangle(cornerRadius: cornerRadius)
            .fill(Color.primary.opacity(animating ? 0.07 : 0.17))
            .onAppear {
                withAnimation(
                    .easeInOut(duration: 0.85)
                    .repeatForever(autoreverses: true)
                    .delay(Double.random(in: 0...0.25))
                ) { animating = true }
            }
    }
}

// MARK: - Stat card grid (Home)

struct StatCardSkeleton: View {
    var body: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            ForEach(0..<4, id: \.self) { _ in
                VStack(alignment: .leading, spacing: 10) {
                    Skeleton(cornerRadius: 4).frame(width: 22, height: 22)
                    Skeleton().frame(width: 48, height: 28)
                    Skeleton().frame(width: 84, height: 11)
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(.quaternary, in: RoundedRectangle(cornerRadius: 12))
            }
        }
    }
}

// MARK: - Booking list row

struct BookingRowSkeleton: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack {
                Skeleton().frame(width: 160, height: 14)
                Spacer()
                Skeleton(cornerRadius: 9).frame(width: 58, height: 18)
            }
            Skeleton().frame(width: 120, height: 12)
            Skeleton().frame(width: 96, height: 10)
        }
        .padding(.vertical, 6)
    }
}

// MARK: - Item list row

struct ItemRowSkeleton: View {
    var body: some View {
        HStack(spacing: 12) {
            Skeleton(cornerRadius: 8).frame(width: 44, height: 44)
            VStack(alignment: .leading, spacing: 6) {
                Skeleton().frame(width: 140, height: 14)
                Skeleton().frame(width: 88, height: 11)
            }
            Spacer()
            Skeleton(cornerRadius: 10).frame(width: 64, height: 20)
        }
        .padding(.vertical, 4)
    }
}

// MARK: - Event list row

struct EventRowSkeleton: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            Skeleton().frame(width: 200, height: 15)
            Skeleton().frame(width: 130, height: 12)
            Skeleton(cornerRadius: 10).frame(width: 88, height: 20)
        }
        .padding(.vertical, 6)
    }
}

// MARK: - Dashboard shift row

struct ShiftRowSkeleton: View {
    var body: some View {
        HStack(spacing: 12) {
            Skeleton(cornerRadius: 8).frame(width: 48, height: 44)
            VStack(alignment: .leading, spacing: 5) {
                Skeleton().frame(width: 150, height: 14)
                Skeleton().frame(width: 100, height: 11)
            }
            Spacer()
        }
        .padding(10)
        .background(.quaternary.opacity(0.3), in: RoundedRectangle(cornerRadius: 10))
    }
}

// MARK: - Item detail page skeleton

struct ItemDetailSkeleton: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                HStack(alignment: .top, spacing: 12) {
                    Skeleton(cornerRadius: 8).frame(width: 72, height: 72)
                    VStack(alignment: .leading, spacing: 8) {
                        Skeleton().frame(width: 180, height: 18)
                        Skeleton().frame(width: 80, height: 12)
                        Skeleton(cornerRadius: 10).frame(width: 72, height: 20)
                    }
                    Spacer()
                }
                Divider()
                VStack(alignment: .leading, spacing: 10) {
                    Skeleton().frame(width: 56, height: 10)
                    ForEach(0..<4, id: \.self) { _ in
                        HStack {
                            Skeleton().frame(width: 80, height: 12)
                            Spacer()
                            Skeleton().frame(width: 120, height: 12)
                        }
                    }
                }
            }
            .padding()
        }
        .allowsHitTesting(false)
    }
}

// MARK: - Booking detail page skeleton

struct BookingDetailSkeleton: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Skeleton(cornerRadius: 10).frame(width: 88, height: 22)
                        Spacer()
                        Skeleton().frame(width: 60, height: 12)
                    }
                    Skeleton().frame(width: 200, height: 14)
                    Skeleton().frame(width: 160, height: 14)
                    Skeleton().frame(width: 220, height: 28)
                }
                Divider()
                VStack(alignment: .leading, spacing: 6) {
                    Skeleton().frame(width: 72, height: 10)
                    Skeleton().frame(width: 140, height: 14)
                    Skeleton().frame(width: 180, height: 12)
                }
                Divider()
                VStack(alignment: .leading, spacing: 8) {
                    Skeleton().frame(width: 80, height: 10)
                    ForEach(0..<3, id: \.self) { _ in
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Skeleton().frame(width: 150, height: 13)
                                Skeleton().frame(width: 80, height: 10)
                            }
                            Spacer()
                            Skeleton(cornerRadius: 8).frame(width: 60, height: 18)
                        }
                    }
                }
            }
            .padding()
        }
        .allowsHitTesting(false)
    }
}

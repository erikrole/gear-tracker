import SwiftUI

struct KioskShellView: View {
    @Environment(KioskStore.self) private var store

    var body: some View {
        ZStack {
            Color(red: 11/255, green: 11/255, blue: 13/255).ignoresSafeArea()

            Group {
                switch store.screen {
                case .activation:
                    KioskActivationView()
                case .idle:
                    KioskIdleView()
                case .studentHub(let user):
                    KioskStudentHubView(user: user)
                case .checkout(let userId):
                    KioskCheckoutView(userId: userId)
                case .pickup(let bookingId, let userId):
                    KioskPickupView(bookingId: bookingId, userId: userId)
                case .return(let bookingId, let userId):
                    KioskReturnView(bookingId: bookingId, userId: userId)
                case .success(let message):
                    KioskSuccessView(message: message)
                }
            }
        }
        .preferredColorScheme(.dark)
        .persistentSystemOverlays(.hidden)
        .statusBarHidden()
        .simultaneousGesture(TapGesture().onEnded { store.resetInactivity() })
        .simultaneousGesture(DragGesture(minimumDistance: 0).onChanged { _ in store.resetInactivity() })
    }
}

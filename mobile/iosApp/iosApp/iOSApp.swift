import SwiftUI
import Shared

// Koin est démarré par MainViewController (côté Kotlin) à la première ouverture de l'écran : rien à initialiser ici.
@main
struct iOSApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

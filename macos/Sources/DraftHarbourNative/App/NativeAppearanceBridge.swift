import AppKit
import DraftHarbourNativeCore
import SwiftUI

private let nativeAppearanceStorageKey = "DraftHarbour.editor.theme"

struct NativeAppearanceBridge: ViewModifier {
  @AppStorage(nativeAppearanceStorageKey) private var theme = "auto"
  @State private var autoColorScheme = NativeResolvedAppearance.storedSystemColorScheme

  func body(content: Content) -> some View {
    content
      .preferredColorScheme(preferredColorScheme)
      .onAppear(perform: applyAppearance)
      .onChange(of: theme) { _, _ in
        applyAppearance()
      }
      .onReceive(NotificationCenter.default.publisher(for: NSApplication.didBecomeActiveNotification)) { _ in
        applyAppearance()
      }
      .onReceive(DistributedNotificationCenter.default().publisher(for: Notification.Name("AppleInterfaceThemeChangedNotification"))) { _ in
        applyAppearance()
      }
  }

  private var preferredColorScheme: ColorScheme? {
    switch themePreference {
    case .auto:
      return autoColorScheme
    case .light:
      return .light
    case .dark:
      return .dark
    }
  }

  private var themePreference: ThemePreference {
    ThemePreference(storageValue: theme)
  }

  @MainActor private func applyAppearance() {
    let normalized = ThemePreference.normalizedRawValue(theme)
    if normalized != theme {
      theme = normalized
    }

    switch ThemePreference(storageValue: normalized) {
    case .auto:
      let resolvedAppearance = NativeResolvedAppearance.system
      autoColorScheme = resolvedAppearance.colorScheme
      NSApp.appearance = resolvedAppearance.nsAppearance
    case .light:
      NSApp.appearance = NSAppearance(named: .aqua)
    case .dark:
      NSApp.appearance = NSAppearance(named: .darkAqua)
    }
  }
}

private enum NativeResolvedAppearance {
  case light
  case dark

  @MainActor static var system: NativeResolvedAppearance {
    NSApp.appearance = nil
    let match = NSApp.effectiveAppearance.bestMatch(from: [.darkAqua, .aqua])
    return match == .darkAqua ? .dark : .light
  }

  static var storedSystemColorScheme: ColorScheme {
    UserDefaults.standard.string(forKey: "AppleInterfaceStyle") == "Dark" ? .dark : .light
  }

  var colorScheme: ColorScheme {
    switch self {
    case .light:
      return .light
    case .dark:
      return .dark
    }
  }

  var nsAppearance: NSAppearance? {
    switch self {
    case .light:
      return NSAppearance(named: .aqua)
    case .dark:
      return NSAppearance(named: .darkAqua)
    }
  }
}

extension View {
  func nativeAppearanceBridge() -> some View {
    modifier(NativeAppearanceBridge())
  }
}

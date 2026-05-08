import Foundation

public struct NativePluginManifest: Codable, Equatable, Identifiable, Sendable {
  public var id: String
  public var name: String
  public var version: String

  public init(id: String, name: String, version: String) {
    self.id = id
    self.name = name
    self.version = version
  }
}

public struct NativePluginEvent: Codable, Equatable, Sendable {
  public var name: String
  public var payload: [String: JSONValue]
  public var timestamp: Int64

  public init(name: String, payload: [String: JSONValue] = [:], timestamp: Int64 = currentTimeMilliseconds()) {
    self.name = name
    self.payload = payload
    self.timestamp = timestamp
  }
}

public final class NativePluginRuntime: @unchecked Sendable {
  public static let shared = NativePluginRuntime()

  public typealias EventHandler = @Sendable (NativePluginEvent) -> Void
  public typealias StringFilter = @Sendable (String) -> String

  private struct Handler {
    var token: String
    var pluginID: String
    var callback: EventHandler
  }

  private struct Filter {
    var token: String
    var pluginID: String
    var callback: StringFilter
  }

  private let lock = NSLock()
  private var plugins: [String: NativePluginManifest] = [:]
  private var enabledPluginIDs: Set<String> = []
  private var handlers: [String: [Handler]] = [:]
  private var filters: [String: [Filter]] = [:]
  private var storage: [String: [String: JSONValue]] = [:]

  public init() {}

  public func register(_ manifest: NativePluginManifest, enabled: Bool = true) {
    lock.withLock {
      plugins[manifest.id] = manifest
      if enabled {
        enabledPluginIDs.insert(manifest.id)
      }
    }
  }

  public func unregister(pluginID: String) {
    lock.withLock {
      plugins.removeValue(forKey: pluginID)
      enabledPluginIDs.remove(pluginID)
      handlers = handlers.mapValues { $0.filter { $0.pluginID != pluginID } }
      filters = filters.mapValues { $0.filter { $0.pluginID != pluginID } }
      storage.removeValue(forKey: pluginID)
    }
  }

  public func setEnabled(_ enabled: Bool, pluginID: String) {
    lock.withLock {
      if enabled {
        enabledPluginIDs.insert(pluginID)
      } else {
        enabledPluginIDs.remove(pluginID)
      }
    }
  }

  public func registeredPlugins() -> [NativePluginManifest] {
    lock.withLock { plugins.values.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending } }
  }

  public func enabledPlugins() -> [NativePluginManifest] {
    lock.withLock {
      enabledPluginIDs.compactMap { plugins[$0] }.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }
  }

  @discardableResult
  public func on(_ eventName: String, pluginID: String, handler: @escaping EventHandler) -> String {
    let token = makeIdentifier()
    lock.withLock {
      handlers[eventName, default: []].append(Handler(token: token, pluginID: pluginID, callback: handler))
    }
    return token
  }

  public func off(_ token: String) {
    lock.withLock {
      handlers = handlers.mapValues { $0.filter { $0.token != token } }
      filters = filters.mapValues { $0.filter { $0.token != token } }
    }
  }

  @discardableResult
  public func emit(_ name: String, payload: [String: JSONValue] = [:]) -> Int {
    guard !NativeOperationalGuardrails.shared.isSafeModeEnabledForSession else { return 0 }
    let event = NativePluginEvent(name: name, payload: payload)
    let callbacks = lock.withLock {
      (handlers[name] ?? []).filter { enabledPluginIDs.contains($0.pluginID) }.map(\.callback)
    }
    callbacks.forEach { $0(event) }
    return callbacks.count
  }

  @discardableResult
  public func registerStringFilter(_ name: String, pluginID: String, filter: @escaping StringFilter) -> String {
    let token = makeIdentifier()
    lock.withLock {
      filters[name, default: []].append(Filter(token: token, pluginID: pluginID, callback: filter))
    }
    return token
  }

  public func applyStringFilters(_ name: String, to value: String) -> String {
    guard !NativeOperationalGuardrails.shared.isSafeModeEnabledForSession else { return value }
    let callbacks = lock.withLock {
      (filters[name] ?? []).filter { enabledPluginIDs.contains($0.pluginID) }.map(\.callback)
    }
    return callbacks.reduce(value) { current, filter in filter(current) }
  }

  public func setStorageValue(_ value: JSONValue, key: String, pluginID: String) {
    lock.withLock {
      storage[pluginID, default: [:]][key] = value
    }
  }

  public func storageValue(key: String, pluginID: String) -> JSONValue? {
    lock.withLock { storage[pluginID]?[key] }
  }

  public func clearStorage(pluginID: String) {
    lock.withLock {
      storage.removeValue(forKey: pluginID)
      return ()
    }
  }

  public func resetForTesting() {
    lock.withLock {
      plugins.removeAll()
      enabledPluginIDs.removeAll()
      handlers.removeAll()
      filters.removeAll()
      storage.removeAll()
    }
  }
}

private extension NSLock {
  func withLock<T>(_ body: () -> T) -> T {
    lock()
    defer { unlock() }
    return body()
  }
}

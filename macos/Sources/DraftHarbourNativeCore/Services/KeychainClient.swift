import Foundation
import Security

public final class KeychainClient: @unchecked Sendable {
  public static let shared = KeychainClient(service: "DraftHarbourNative")

  private let service: String

  public init(service: String) {
    self.service = service
  }

  public func setSecret(_ value: String, account: String) throws {
    let data = Data(value.utf8)
    let query = baseQuery(account: account)
    SecItemDelete(query as CFDictionary)

    var attributes = query
    attributes[kSecValueData as String] = data
    let status = SecItemAdd(attributes as CFDictionary, nil)
    guard status == errSecSuccess else {
      throw DraftHarbourError.keychainFailure(status)
    }
  }

  public func secret(account: String) throws -> String? {
    var query = baseQuery(account: account)
    query[kSecReturnData as String] = true
    query[kSecMatchLimit as String] = kSecMatchLimitOne

    var result: AnyObject?
    let status = SecItemCopyMatching(query as CFDictionary, &result)

    if status == errSecItemNotFound {
      return nil
    }

    guard status == errSecSuccess else {
      throw DraftHarbourError.keychainFailure(status)
    }

    guard let data = result as? Data else {
      return nil
    }

    return String(data: data, encoding: .utf8)
  }

  public func deleteSecret(account: String) throws {
    let status = SecItemDelete(baseQuery(account: account) as CFDictionary)
    guard status == errSecSuccess || status == errSecItemNotFound else {
      throw DraftHarbourError.keychainFailure(status)
    }
  }

  private func baseQuery(account: String) -> [String: Any] {
    [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account
    ]
  }
}

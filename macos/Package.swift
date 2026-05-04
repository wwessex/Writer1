// swift-tools-version: 6.0

import PackageDescription

let package = Package(
  name: "DraftHarbourNative",
  platforms: [
    .macOS(.v14)
  ],
  products: [
    .library(
      name: "DraftHarbourNativeCore",
      targets: ["DraftHarbourNativeCore"]
    ),
    .executable(
      name: "DraftHarbourNative",
      targets: ["DraftHarbourNative"]
    )
  ],
  dependencies: [
    .package(url: "https://github.com/weichsel/ZIPFoundation.git", .upToNextMajor(from: "0.9.0"))
  ],
  targets: [
    .target(
      name: "DraftHarbourNativeCore",
      dependencies: ["ZIPFoundation"]
    ),
    .executableTarget(
      name: "DraftHarbourNative",
      dependencies: ["DraftHarbourNativeCore"]
    ),
    .testTarget(
      name: "DraftHarbourNativeCoreTests",
      dependencies: ["DraftHarbourNativeCore"]
    )
  ]
)

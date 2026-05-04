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
  targets: [
    .target(
      name: "DraftHarbourNativeCore"
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

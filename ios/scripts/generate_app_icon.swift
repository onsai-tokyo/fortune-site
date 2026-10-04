import AppKit
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

enum IconAppearance {
    case light, dark, tinted

    var foreground: CGColor { CGColor(gray: 1, alpha: 1) }

}

func render(size: Int, appearance: IconAppearance, background: CGImage, destination: URL) throws {
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    guard let context = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8,
                                  bytesPerRow: size * 4, space: colorSpace,
                                  bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { return }
    context.interpolationQuality = .high
    context.draw(background, in: CGRect(x: 0, y: 0, width: size, height: size))

    // FateMark.swift と同じ比率。意匠には手を加えず、アイコン中央へ拡大して書き出す。
    let mark = CGFloat(size) * 0.78
    let center = CGPoint(x: CGFloat(size) / 2, y: CGFloat(size) / 2)
    let line = max(1, mark / 84)
    context.setStrokeColor(appearance.foreground)
    context.setFillColor(appearance.foreground)
    context.setLineWidth(line)

    context.strokeEllipse(in: CGRect(x: center.x - mark / 2, y: center.y - mark * 0.29,
                                     width: mark, height: mark * 0.58))
    context.saveGState()
    context.translateBy(x: center.x, y: center.y)
    // CoreGraphics is Y-up; SwiftUI is Y-down. Negate the angle to match FateMark.
    context.rotate(by: -24 * .pi / 180)
    context.strokeEllipse(in: CGRect(x: -mark * 0.29, y: -mark / 2,
                                     width: mark * 0.58, height: mark))
    context.restoreGState()
    context.fill(CGRect(x: center.x - line / 2, y: center.y - mark * 0.46,
                        width: line, height: mark * 0.92))
    let dot = max(3, mark * 0.07)
    context.fillEllipse(in: CGRect(x: center.x + mark * 0.31 - dot / 2,
                                   y: center.y + mark * 0.12 - dot / 2,
                                   width: dot, height: dot))

    guard let image = context.makeImage(),
          let output = CGImageDestinationCreateWithURL(destination as CFURL, UTType.png.identifier as CFString, 1, nil) else { return }
    CGImageDestinationAddImage(output, image, nil)
    guard CGImageDestinationFinalize(output) else { throw CocoaError(.fileWriteUnknown) }
}

let output = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let backgroundURL = URL(fileURLWithPath: CommandLine.arguments[2])
guard let source = CGImageSourceCreateWithURL(backgroundURL as CFURL, nil),
      let background = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
    fatalError("Cannot load sunset icon background")
}
try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
for size in [40, 58, 60, 80, 87, 120, 180, 1024] {
    try render(size: size, appearance: .light, background: background, destination: output.appendingPathComponent("AppIcon-\(size).png"))
}
try render(size: 1024, appearance: .dark, background: background, destination: output.appendingPathComponent("AppIcon-1024-dark.png"))
try render(size: 1024, appearance: .tinted, background: background, destination: output.appendingPathComponent("AppIcon-1024-tinted.png"))

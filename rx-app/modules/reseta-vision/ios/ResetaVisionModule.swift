import ExpoModulesCore
import CoreImage
import UIKit
import Vision
import VisionKit

/// Apple Vision on the phone: straightens a photo of the paper, finds each written line and cuts it out
/// along its own slant, reads one line, and opens the VisionKit document scanner. It holds no safety
/// logic: it returns readings, and the shared TypeScript core decides what they mean.
public class ResetaVisionModule: Module {
  private var scanDelegate: ScanDelegate?

  public func definition() -> ModuleDefinition {
    Name("ResetaVision")

    Function("isScannerSupported") { () -> Bool in
      VNDocumentCameraViewController.isSupported
    }

    /// Physical memory in GB, so the app offers the on-phone AI reader only where it fits.
    Function("memoryGB") { () -> Double in
      Double(ProcessInfo.processInfo.physicalMemory) / 1_073_741_824
    }

    // Returns up to 12 readings of the line, best first, and Vision's confidence in the best one (0–1).
    // The raw pass comes first: English language correction turns "1 tab" into "I tab". The pass with
    // correction and the medicine names as custom words follows; the TypeScript core switches to one of
    // its readings only when it names a listed medicine much more closely.
    AsyncFunction("recognizeLine") { (uri: String, customWords: [String]) -> [String: Any] in
      guard let cg = Self.loadUpright(uri) else {
        throw Exception(name: "E_IMAGE", description: "Could not open the line image.")
      }
      let corrected = try Self.read(cg, correction: true, words: customWords)
      let raw = try Self.read(cg, correction: false, words: [])
      var variants: [String] = []
      for v in Self.variants(raw) + Self.variants(corrected) where !v.isEmpty && !variants.contains(v) {
        variants.append(v)
      }
      let confs = raw.compactMap { $0.topCandidates(1).first?.confidence }
      let confidence = confs.isEmpty ? 0 : Double(confs.reduce(0, +)) / Double(confs.count)
      return ["variants": Array(variants.prefix(12)), "confidence": confidence]
    }

    // Finds the sheet of paper in a photo and flattens it, as the document scanner does.
    // Returns the photo unchanged (straightened: false) when no clear sheet is found.
    AsyncFunction("straighten") { (uri: String) -> [String: Any] in
      guard let cg = Self.loadUpright(uri) else {
        throw Exception(name: "E_IMAGE", description: "Could not open the photo.")
      }
      let flat = Self.flattenPaper(cg)
      let out = flat ?? cg
      let url = try Self.writeJPEG(out, prefix: "reseta-flat")
      return ["uri": url.absoluteString, "width": out.width, "height": out.height, "straightened": flat != nil]
    }

    // Finds every line of writing on the page. Each line comes back with Vision's quick reading, its box
    // on the page (0–1, top-left origin, for drawing) and a crop cut along the line's own slant.
    AsyncFunction("findLines") { (uri: String) -> [[String: Any]] in
      guard let cg = Self.loadUpright(uri) else {
        throw Exception(name: "E_IMAGE", description: "Could not open the photo.")
      }
      return try Self.findLines(cg)
    }

    AsyncFunction("scanDocument") { (promise: Promise) in
      guard VNDocumentCameraViewController.isSupported else { promise.resolve(nil); return }
      guard let presenter = self.appContext?.utilities?.currentViewController() else {
        promise.reject(Exception(name: "E_NO_VIEW", description: "The scanner could not open."))
        return
      }
      let scanner = VNDocumentCameraViewController()
      let delegate = ScanDelegate { [weak self] result in
        promise.resolve(result)
        self?.scanDelegate = nil
      }
      self.scanDelegate = delegate
      scanner.delegate = delegate
      presenter.present(scanner, animated: true)
    }.runOnQueue(.main)
  }

  // MARK: - Images

  private static let ci = CIContext(options: nil)

  /// Loads a file or data URI and redraws it upright, so camera EXIF rotation never reaches Vision.
  static func loadUpright(_ uri: String) -> CGImage? {
    var data: Data?
    if uri.hasPrefix("data:"), let comma = uri.firstIndex(of: ",") {
      data = Data(base64Encoded: String(uri[uri.index(after: comma)...]))
    } else if let url = URL(string: uri) {
      data = try? Data(contentsOf: url)
    }
    guard let d = data, let image = UIImage(data: d) else { return nil }
    if image.imageOrientation == .up, let cg = image.cgImage { return cg }
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    return UIGraphicsImageRenderer(size: image.size, format: format).image { _ in
      image.draw(in: CGRect(origin: .zero, size: image.size))
    }.cgImage
  }

  static func writeJPEG(_ cg: CGImage, prefix: String) throws -> URL {
    let url = FileManager.default.temporaryDirectory.appendingPathComponent("\(prefix)-\(UUID().uuidString).jpg")
    guard let data = UIImage(cgImage: cg).jpegData(compressionQuality: 0.9) else {
      throw Exception(name: "E_IMAGE", description: "Could not save the image.")
    }
    try data.write(to: url)
    return url
  }

  static func dataURI(_ cg: CGImage) -> String? {
    guard let data = UIImage(cgImage: cg).jpegData(compressionQuality: 0.85) else { return nil }
    return "data:image/jpeg;base64," + data.base64EncodedString()
  }

  /// Corrects perspective from four corners given in Vision's normalized, bottom-left-origin space.
  static func perspective(_ cg: CGImage, tl: CGPoint, tr: CGPoint, bl: CGPoint, br: CGPoint) -> CGImage? {
    let w = CGFloat(cg.width), h = CGFloat(cg.height)
    let px = { (p: CGPoint) in CIVector(x: p.x * w, y: p.y * h) }
    guard let filter = CIFilter(name: "CIPerspectiveCorrection") else { return nil }
    filter.setValue(CIImage(cgImage: cg), forKey: kCIInputImageKey)
    filter.setValue(px(tl), forKey: "inputTopLeft")
    filter.setValue(px(tr), forKey: "inputTopRight")
    filter.setValue(px(bl), forKey: "inputBottomLeft")
    filter.setValue(px(br), forKey: "inputBottomRight")
    guard let out = filter.outputImage else { return nil }
    return ci.createCGImage(out, from: out.extent)
  }

  // MARK: - Paper

  static func flattenPaper(_ cg: CGImage) -> CGImage? {
    let handler = VNImageRequestHandler(cgImage: cg, options: [:])
    var quad: VNRectangleObservation?
    let seg = VNDetectDocumentSegmentationRequest()
    if (try? handler.perform([seg])) != nil, let r = seg.results?.first, r.confidence >= 0.5 { quad = r }
    if quad == nil {
      let rect = VNDetectRectanglesRequest()
      rect.minimumAspectRatio = 0.3
      rect.maximumAspectRatio = 1.0
      rect.minimumSize = 0.4
      rect.minimumConfidence = 0.6
      rect.maximumObservations = 1
      if (try? handler.perform([rect])) != nil { quad = rect.results?.first }
    }
    guard let q = quad else { return nil }
    // Skip a "sheet" that is really the whole frame or a small detail inside it.
    let area = abs((q.topRight.x - q.bottomLeft.x) * (q.topRight.y - q.bottomLeft.y))
    let corners = [q.topLeft, q.topRight, q.bottomLeft, q.bottomRight]
    let hugsEdges = corners.allSatisfy { $0.x < 0.02 || $0.x > 0.98 || $0.y < 0.02 || $0.y > 0.98 }
    guard area >= 0.2, !hugsEdges else { return nil }
    return perspective(cg, tl: q.topLeft, tr: q.topRight, bl: q.bottomLeft, br: q.bottomRight)
  }

  // MARK: - Lines

  static func findLines(_ cg: CGImage) throws -> [[String: Any]] {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = ["en-US"]
    request.usesLanguageCorrection = false
    try VNImageRequestHandler(cgImage: cg, orientation: .up, options: [:]).perform([request])
    let observations = (request.results ?? []).sorted { $0.boundingBox.midY > $1.boundingBox.midY }
    var out: [[String: Any]] = []
    for o in observations {
      guard let top = o.topCandidates(1).first, !top.string.trimmingCharacters(in: .whitespaces).isEmpty else { continue }
      // Pad the line's own slanted quad: a little above and below for tall letters, a bit at each end.
      let up = CGVector(dx: o.topLeft.x - o.bottomLeft.x, dy: o.topLeft.y - o.bottomLeft.y)
      let along = CGVector(dx: o.bottomRight.x - o.bottomLeft.x, dy: o.bottomRight.y - o.bottomLeft.y)
      let alongLen = max(hypot(along.dx * CGFloat(cg.width), along.dy * CGFloat(cg.height)), 1)
      let upLen = max(hypot(up.dx * CGFloat(cg.width), up.dy * CGFloat(cg.height)), 1)
      let padUp = 0.35, padAlong = Double(upLen * 0.6 / alongLen)
      func shift(_ p: CGPoint, _ u: Double, _ a: Double) -> CGPoint {
        CGPoint(x: p.x + up.dx * u + along.dx * a, y: p.y + up.dy * u + along.dy * a)
      }
      let tl = shift(o.topLeft, padUp, -padAlong), tr = shift(o.topRight, padUp, padAlong)
      let bl = shift(o.bottomLeft, -padUp, -padAlong), br = shift(o.bottomRight, -padUp, padAlong)
      guard let crop = perspective(cg, tl: tl, tr: tr, bl: bl, br: br), let uri = dataURI(crop) else { continue }
      let b = o.boundingBox
      out.append([
        "text": top.string,
        "confidence": Double(top.confidence),
        "box": ["x": b.minX, "y": 1 - b.maxY, "width": b.width, "height": b.height],
        "crop": uri,
      ])
    }
    return out
  }

  // MARK: - Reading one line

  static func read(_ cg: CGImage, correction: Bool, words: [String]) throws -> [VNRecognizedTextObservation] {
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = ["en-US"]
    request.usesLanguageCorrection = correction
    if correction && !words.isEmpty { request.customWords = words }
    try VNImageRequestHandler(cgImage: cg, orientation: .up, options: [:]).perform([request])
    return request.results ?? []
  }

  /// Joins the pieces Vision found on the line, top-to-bottom then left-to-right, once per candidate rank.
  static func variants(_ observations: [VNRecognizedTextObservation]) -> [String] {
    let sorted = observations.sorted {
      let rowA = ($0.boundingBox.midY * 10).rounded(), rowB = ($1.boundingBox.midY * 10).rounded()
      return rowA == rowB ? $0.boundingBox.minX < $1.boundingBox.minX : rowA > rowB
    }
    let ranked = sorted.map { $0.topCandidates(10).map { $0.string } }.filter { !$0.isEmpty }
    guard let deepest = ranked.map({ $0.count }).max() else { return [] }
    return (0..<deepest).map { k in ranked.map { $0[min(k, $0.count - 1)] }.joined(separator: " ") }
  }
}

private class ScanDelegate: NSObject, VNDocumentCameraViewControllerDelegate {
  private let done: ([String: Any]?) -> Void
  init(_ done: @escaping ([String: Any]?) -> Void) { self.done = done }

  func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFinishWith scan: VNDocumentCameraScan) {
    controller.dismiss(animated: true)
    guard scan.pageCount > 0 else { done(nil); return }
    let page = scan.imageOfPage(at: 0)
    let url = FileManager.default.temporaryDirectory.appendingPathComponent("reseta-scan-\(UUID().uuidString).jpg")
    guard let data = page.jpegData(compressionQuality: 0.9), (try? data.write(to: url)) != nil else { done(nil); return }
    done(["uri": url.absoluteString, "width": page.size.width * page.scale, "height": page.size.height * page.scale])
  }

  func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) {
    controller.dismiss(animated: true)
    done(nil)
  }

  func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFailWithError error: Error) {
    controller.dismiss(animated: true)
    done(nil)
  }
}

import ActivityKit
import Foundation

// The daily intake reminder on the Lock Screen and in the Dynamic Island: the doses due at one time,
// with Taken and Skip. Identical to targets/widget/_shared/IntakeActivityAttributes.swift (the app and
// widget copy); this one is the module's, which starts it.
@available(iOS 16.1, *)
struct IntakeActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var items: [String] // "Creatine · 5 g"
    var dueAt: Date
    var slot: String // "2026-10-27|08:00": the day and time answered as one
  }

  var title: String
}

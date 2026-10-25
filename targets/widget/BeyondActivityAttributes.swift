import ActivityKit
import Foundation

// The live session shown on the Lock Screen and in the Dynamic Island. Kept identical to the copy in
// modules/live-activity/ios, which the app uses to start and update it.
struct BeyondActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var mode: String // "lift", "rest", "cardio" or "paused"
    var title: String // workout or activity name
    var subtitle: String // exercise and set, or phase and cue
    var symbol: String // SF Symbol
    var accent: String // hex colour
    var startedAt: Date? // counts up from here (lifting)
    var endsAt: Date? // counts down to here (rest, cardio phase)
    var total: Double // seconds of the countdown, for its ring
  }

  var name: String
}

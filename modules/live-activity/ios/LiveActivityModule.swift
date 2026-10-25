import ActivityKit
import ExpoModulesCore
import os

// Starts, updates and ends the one live session activity. Dates arrive as milliseconds since 1970.
// Every step is logged under the "BeyondLive" category, so the device log shows what iOS said.
private let beyondLog = os.Logger(subsystem: "app.beyond.fitness", category: "BeyondLive")

public class LiveActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LiveActivity")

    // Lets the app write its own steps into the device log next to what iOS reports.
    Function("log") { (message: String) in
      beyondLog.notice("js: \(message, privacy: .public)")
    }

    Function("isAvailable") { () -> Bool in
      if #available(iOS 16.2, *) {
        let enabled = ActivityAuthorizationInfo().areActivitiesEnabled
        beyondLog.notice("isAvailable: enabled=\(enabled)")
        return enabled
      }
      return false
    }

    Function("status") { () -> [String: Any] in
      if #available(iOS 16.2, *) {
        return [
          "supported": true,
          "enabled": ActivityAuthorizationInfo().areActivitiesEnabled,
          "running": Activity<BeyondActivityAttributes>.activities.count,
        ]
      }
      return ["supported": false, "enabled": false, "running": 0]
    }

    AsyncFunction("start") { (name: String, state: [String: Any]) -> String? in
      guard #available(iOS 16.2, *) else { return nil }
      for activity in Activity<BeyondActivityAttributes>.activities {
        await activity.end(nil, dismissalPolicy: .immediate)
      }
      let content = ActivityContent(state: Self.parse(state), staleDate: nil)
      do {
        // Requested from the main thread, where ActivityKit expects the app to start activities.
        let id = try await MainActor.run {
          try Activity.request(attributes: BeyondActivityAttributes(name: name), content: content, pushType: nil).id
        }
        beyondLog.notice("start: ok \(id, privacy: .public)")
        return id
      } catch {
        beyondLog.error("start failed: \(String(describing: error), privacy: .public)")
        throw error
      }
    }

    AsyncFunction("update") { (state: [String: Any]) in
      guard #available(iOS 16.2, *) else { return }
      let content = ActivityContent(state: Self.parse(state), staleDate: nil)
      for activity in Activity<BeyondActivityAttributes>.activities {
        await activity.update(content)
      }
      beyondLog.notice("update: \(Activity<BeyondActivityAttributes>.activities.count) activities")
    }

    AsyncFunction("end") { () in
      guard #available(iOS 16.2, *) else { return }
      for activity in Activity<BeyondActivityAttributes>.activities {
        await activity.end(nil, dismissalPolicy: .immediate)
      }
      beyondLog.notice("end")
    }
  }

  private static func date(_ v: Any?) -> Date? {
    guard let ms = v as? Double else { return nil }
    return Date(timeIntervalSince1970: ms / 1000)
  }

  @available(iOS 16.2, *)
  static func parse(_ s: [String: Any]) -> BeyondActivityAttributes.ContentState {
    BeyondActivityAttributes.ContentState(
      mode: s["mode"] as? String ?? "lift",
      title: s["title"] as? String ?? "",
      subtitle: s["subtitle"] as? String ?? "",
      symbol: s["symbol"] as? String ?? "dumbbell.fill",
      accent: s["accent"] as? String ?? "#40E0F0",
      startedAt: date(s["startedAt"]),
      endsAt: date(s["endsAt"]),
      total: s["total"] as? Double ?? 0
    )
  }
}

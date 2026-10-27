import ActivityKit
import ExpoModulesCore
import os

// Starts, updates and ends the one live session activity. Dates arrive as milliseconds since 1970.
// Every step is logged under the "BeyondLive" category, so the device log shows what iOS said.
private let beyondLog = os.Logger(subsystem: "app.beyond.fitness", category: "BeyondLive")

public class LiveActivityModule: Module {
  private var answerObserver: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("LiveActivity")

    // Taken or Skip pressed on the intake reminder (IntakeAnswerIntent, run inside the app).
    Events("onIntakeAnswer")
    OnStartObserving {
      self.answerObserver = NotificationCenter.default.addObserver(forName: Notification.Name("BeyondIntakeAnswer"), object: nil, queue: .main) { [weak self] _ in
        self?.sendEvent("onIntakeAnswer", [:])
      }
    }
    OnStopObserving {
      if let o = self.answerObserver { NotificationCenter.default.removeObserver(o) }
      self.answerObserver = nil
    }

    /// Answers given on the intake reminder since the app last asked ("2026-10-27|08:00|taken"), cleared.
    Function("takeIntakeAnswers") { () -> [String] in
      let key = "beyond.intakeAnswers"
      let pending = UserDefaults.standard.stringArray(forKey: key) ?? []
      UserDefaults.standard.removeObject(forKey: key)
      return pending
    }

    /// Shows the doses due at one time, until answered. Replaces any intake reminder already up.
    AsyncFunction("startIntake") { (title: String, items: [String], dueAt: Double, slot: String) -> String? in
      guard #available(iOS 16.2, *) else { return nil }
      for activity in Activity<IntakeActivityAttributes>.activities where activity.content.state.slot != slot {
        await activity.end(nil, dismissalPolicy: .immediate)
      }
      let due = Date(timeIntervalSince1970: dueAt / 1000)
      let state = IntakeActivityAttributes.ContentState(items: items, dueAt: due, slot: slot)
      // Stale at the due time: the reminder turns to "Due now" by itself.
      let content = ActivityContent(state: state, staleDate: due)
      if let running = Activity<IntakeActivityAttributes>.activities.first(where: { $0.content.state.slot == slot }) {
        await running.update(content)
        return running.id
      }
      do {
        let id = try await MainActor.run {
          try Activity.request(attributes: IntakeActivityAttributes(title: title), content: content, pushType: nil).id
        }
        beyondLog.notice("intake: started \(slot, privacy: .public)")
        return id
      } catch {
        beyondLog.error("intake failed: \(String(describing: error), privacy: .public)")
        throw error
      }
    }

    /// Closes the intake reminder (all of them, or the one for a slot).
    AsyncFunction("endIntake") { (slot: String?) in
      guard #available(iOS 16.2, *) else { return }
      for activity in Activity<IntakeActivityAttributes>.activities where slot == nil || activity.content.state.slot == slot {
        await activity.end(nil, dismissalPolicy: .immediate)
      }
    }

    /// The slot the intake reminder is showing, if any.
    Function("intakeSlot") { () -> String? in
      guard #available(iOS 16.2, *) else { return nil }
      return Activity<IntakeActivityAttributes>.activities.first?.content.state.slot
    }

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
      let content = ActivityContent(state: Self.parse(state), staleDate: Self.date(state["staleAt"]))
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
      let content = ActivityContent(state: Self.parse(state), staleDate: Self.date(state["staleAt"]))
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

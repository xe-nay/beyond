import ActivityKit
import AppIntents
import Foundation

// Taken or Skip, pressed on the intake Live Activity. iOS runs it inside the app (without opening it):
// the answer is kept for the app, which applies it at once when it is running and otherwise as soon as
// it next starts, and the reminder is closed.
@available(iOS 17.0, *)
struct IntakeAnswerIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Answer daily intake"
  static var isDiscoverable: Bool = false

  @Parameter(title: "Slot") var slot: String
  @Parameter(title: "Answer") var answer: String

  init() {}
  init(slot: String, answer: String) {
    self.slot = slot
    self.answer = answer
  }

  func perform() async throws -> some IntentResult {
    let key = "beyond.intakeAnswers"
    var pending = UserDefaults.standard.stringArray(forKey: key) ?? []
    pending.append("\(slot)|\(answer)")
    UserDefaults.standard.set(pending, forKey: key)
    NotificationCenter.default.post(name: Notification.Name("BeyondIntakeAnswer"), object: nil)
    for activity in Activity<IntakeActivityAttributes>.activities where activity.content.state.slot == slot {
      await activity.end(nil, dismissalPolicy: .immediate)
    }
    return .result()
  }
}

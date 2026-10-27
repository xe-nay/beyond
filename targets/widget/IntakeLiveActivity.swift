import ActivityKit
import AppIntents
import SwiftUI
import WidgetKit

// The daily intake reminder: what to take and when, on the Lock Screen and in the Dynamic Island, with
// Taken and Skip (iOS 17+). At the due time it turns to "Due now" by itself (its stale date), since the
// app may not be running to update it.

private let lime = Color(red: 0.76, green: 0.98, blue: 0.36)
private let cyan = Color(red: 0.25, green: 0.88, blue: 0.94)
private let amber = Color(red: 1.0, green: 0.70, blue: 0.25)

private struct Due: View {
  let state: IntakeActivityAttributes.ContentState
  let stale: Bool
  var body: some View {
    if stale || state.dueAt <= Date() {
      Text("Due now").foregroundStyle(amber)
    } else {
      Text("Due \(state.dueAt, style: .time)").foregroundStyle(cyan)
    }
  }
}

private struct Answers: View {
  let slot: String
  var body: some View {
    if #available(iOS 17.0, *) {
      HStack(spacing: 10) {
        Button(intent: IntakeAnswerIntent(slot: slot, answer: "skip")) {
          Text("Skip").font(.subheadline.weight(.semibold)).frame(maxWidth: .infinity)
        }
        .tint(.gray)
        Button(intent: IntakeAnswerIntent(slot: slot, answer: "taken")) {
          Label("Taken", systemImage: "checkmark").font(.subheadline.weight(.semibold)).frame(maxWidth: .infinity)
        }
        .tint(lime)
      }
      .buttonStyle(.borderedProminent)
    } else {
      Text("Open Beyond to tick it").font(.footnote).foregroundStyle(.secondary)
    }
  }
}

private struct Items: View {
  let items: [String]
  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      ForEach(items.prefix(4), id: \.self) { Text($0).font(.subheadline).lineLimit(1) }
      if items.count > 4 { Text("+\(items.count - 4) more").font(.footnote).foregroundStyle(.secondary) }
    }
  }
}

struct IntakeLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: IntakeActivityAttributes.self) { context in
      VStack(alignment: .leading, spacing: 10) {
        HStack {
          Image(systemName: "pills.fill").foregroundStyle(cyan)
          Text(context.attributes.title).font(.headline)
          Spacer()
          Due(state: context.state, stale: context.isStale).font(.subheadline.weight(.semibold))
        }
        Items(items: context.state.items)
        Answers(slot: context.state.slot)
      }
      .padding(16)
      .activityBackgroundTint(Color.black.opacity(0.85))
      .activitySystemActionForegroundColor(.white)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Image(systemName: "pills.fill").font(.title2).foregroundStyle(cyan).padding(.leading, 4)
        }
        DynamicIslandExpandedRegion(.trailing) {
          Due(state: context.state, stale: context.isStale).font(.subheadline.weight(.semibold))
        }
        DynamicIslandExpandedRegion(.bottom) {
          VStack(alignment: .leading, spacing: 8) {
            Items(items: context.state.items)
            Answers(slot: context.state.slot)
          }
        }
      } compactLeading: {
        Image(systemName: "pills.fill").foregroundStyle(cyan)
      } compactTrailing: {
        if context.isStale || context.state.dueAt <= Date() {
          Text("Now").font(.caption2.weight(.bold)).foregroundStyle(amber)
        } else {
          Text(context.state.dueAt, style: .time).font(.caption2.weight(.semibold)).foregroundStyle(cyan)
            .frame(maxWidth: 52)
        }
      } minimal: {
        Image(systemName: "pills.fill").foregroundStyle(context.isStale ? amber : cyan)
      }
      .keylineTint(cyan)
    }
  }
}

import ActivityKit
import SwiftUI
import WidgetKit

// Live session on the Lock Screen and in the Dynamic Island.
// Lifting: a dumbbell with the session time counting up. Resting: a countdown ring and the time
// left. Cardio: the activity in the phase colour with the phase time left. The clocks are drawn by
// the system, so they keep running while the app sleeps.

private typealias State = BeyondActivityAttributes.ContentState

private extension Color {
  init(hex: String) {
    var v: UInt64 = 0
    Scanner(string: hex.replacingOccurrences(of: "#", with: "")).scanHexInt64(&v)
    self.init(red: Double((v >> 16) & 0xFF) / 255, green: Double((v >> 8) & 0xFF) / 255, blue: Double(v & 0xFF) / 255)
  }
}

private struct Clock: View {
  let state: State
  var body: some View {
    if let end = state.endsAt, end > Date() {
      Text(timerInterval: Date()...end, countsDown: true)
    } else if let start = state.startedAt {
      Text(start, style: .timer)
    } else {
      Text(state.mode == "paused" ? "Paused" : "0:00")
    }
  }
}

/// A ring that drains over the countdown; a plain symbol when there is nothing to count down.
private struct Badge: View {
  let state: State
  var size: CGFloat
  var body: some View {
    let accent = Color(hex: state.accent)
    if let end = state.endsAt, end > Date(), state.total > 0 {
      ProgressView(timerInterval: end.addingTimeInterval(-state.total)...end, countsDown: true) {
        EmptyView()
      } currentValueLabel: {
        Image(systemName: state.symbol).font(.system(size: size * 0.38, weight: .bold)).foregroundStyle(accent)
      }
      .progressViewStyle(.circular)
      .tint(accent)
      .frame(width: size, height: size)
    } else {
      ZStack {
        Circle().fill(accent.opacity(0.2))
        Image(systemName: state.symbol).font(.system(size: size * 0.42, weight: .bold)).foregroundStyle(accent)
      }
      .frame(width: size, height: size)
    }
  }
}

private struct LockScreen: View {
  let state: State
  var body: some View {
    HStack(spacing: 14) {
      Badge(state: state, size: 46)
      VStack(alignment: .leading, spacing: 2) {
        Text(state.title).font(.headline).foregroundStyle(.white).lineLimit(1)
        Text(state.subtitle).font(.subheadline).foregroundStyle(.white.opacity(0.65)).lineLimit(1)
      }
      Spacer(minLength: 8)
      Clock(state: state)
        .font(.system(size: 34, weight: .semibold, design: .rounded))
        .monospacedDigit()
        .foregroundStyle(Color(hex: state.accent))
        .multilineTextAlignment(.trailing)
        .frame(maxWidth: 120, alignment: .trailing)
    }
    .padding(16)
    .activityBackgroundTint(Color.black.opacity(0.85))
    .activitySystemActionForegroundColor(.white)
  }
}

struct BeyondLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: BeyondActivityAttributes.self) { context in
      LockScreen(state: context.state)
    } dynamicIsland: { context in
      let s = context.state
      let accent = Color(hex: s.accent)
      return DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Badge(state: s, size: 44).padding(.leading, 4)
        }
        DynamicIslandExpandedRegion(.trailing) {
          Clock(state: s)
            .font(.system(size: 30, weight: .semibold, design: .rounded))
            .monospacedDigit()
            .foregroundStyle(accent)
            .multilineTextAlignment(.trailing)
            .frame(maxWidth: 110, alignment: .trailing)
        }
        DynamicIslandExpandedRegion(.bottom) {
          VStack(alignment: .leading, spacing: 2) {
            Text(s.title).font(.headline).lineLimit(1)
            Text(s.subtitle).font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
          }
          .frame(maxWidth: .infinity, alignment: .leading)
          .padding(.horizontal, 4)
        }
      } compactLeading: {
        Image(systemName: s.symbol).font(.system(size: 14, weight: .bold)).foregroundStyle(accent)
      } compactTrailing: {
        Clock(state: s)
          .font(.system(size: 14, weight: .semibold, design: .rounded))
          .monospacedDigit()
          .foregroundStyle(accent)
          .frame(maxWidth: 52)
      } minimal: {
        Badge(state: s, size: 22)
      }
      .keylineTint(accent)
    }
  }
}

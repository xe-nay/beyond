// The daily intake reminders as Live Activities on the Lock Screen and in the Dynamic Island, with Taken
// and Skip that work without opening the app: one for each time something is still to take, appearing
// 15 minutes before it and staying ("Due now") until answered. Whenever the app is open it schedules the
// next 24 hours: on iOS 26 the system starts each one at its moment even with Beyond closed (before,
// one could only start while the app was on screen, so a reminder came only as a notification). Two
// times close together each get their own. Answers pressed while the app was closed are applied when
// it next starts.
import { AppState } from 'react-native';

import { endIntake, intakeSlots, onIntakeAnswer, planIntakes, takeIntakeAnswers } from '../modules/live-activity';
import { answered, formatDose } from './domain/supplements';
import type { Intake, Supplement } from './domain/types';
import { answerSlot } from './intakeActions';
import { soon as replanReminders } from './reminders';
import { today, useStore } from './store';

const DAY = 86400000;

/**
 * Every reminder time from now to 24 hours ahead with something unanswered, and today's earlier times
 * still unanswered (shown as due).
 */
export function upcomingSlots(
  s: { supplements: Supplement[]; intakes: Intake[]; skipped: { supplementId: string; date: string }[] },
  now = new Date(),
) {
  const times = [...new Set(s.supplements.map((x) => x.time).filter((t): t is string => !!t))].sort();
  const out: { date: string; time: string; slot: string; dueAt: number; items: string[] }[] = [];
  for (const offset of [0, 1]) {
    const date = today(new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, 12));
    for (const time of times) {
      const dueAt = new Date(`${date}T${time}:00`).getTime();
      if (dueAt - now.getTime() > DAY) continue;
      const due = s.supplements.filter((x) => x.time === time && x.createdAt.slice(0, 10) <= date && !answered(x.id, date, s.intakes, s.skipped));
      if (due.length) out.push({ date, time, slot: `${date}|${time}`, dueAt, items: due.map((x) => `${x.name} · ${formatDose(x)}`) });
    }
  }
  return out;
}

/**
 * iOS lets one app hold only a few Live Activities at once (about five in reports; Apple gives no number)
 * and scheduled ones count. One for each time of the day filled that up, and the workout's own activity
 * was then refused: nothing showed in the Dynamic Island. So at most two are live: the latest one due and
 * the next one coming. The other times get ordinary notifications (reminders.ts skips only covered ones).
 */
export const MAX_LIVE_INTAKES = 2;
export function liveSlots<T extends { dueAt: number }>(slots: T[], now = Date.now()): T[] {
  const sorted = [...slots].sort((a, b) => a.dueAt - b.dueAt);
  const due = sorted.filter((x) => x.dueAt <= now);
  const next = sorted.filter((x) => x.dueAt > now);
  return [...due.slice(-1), ...next].slice(0, MAX_LIVE_INTAKES);
}

/** Applies Taken / Skip pressed on the reminder. */
function applyAnswers() {
  for (const a of takeIntakeAnswers()) answerSlot(a.date, a.time, a.answer);
}

let running = false;
async function refresh() {
  if (running || !useStore.getState().ready) return;
  running = true;
  try {
    applyAnswers();
    const plans = liveSlots(upcomingSlots(useStore.getState()));
    if (AppState.currentState === 'active') {
      // Schedules, starts, updates and ends them all; then notifications skip the times they cover.
      await planIntakes(plans.map(({ slot, items, dueAt }) => ({ slot, items, dueAt })));
    } else {
      // In the background they cannot be started, only closed once answered.
      for (const slot of intakeSlots()) if (!plans.some((p) => p.slot === slot)) await endIntake(slot);
    }
    replanReminders();
  } finally {
    running = false;
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;
const soon = () => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(refresh, 600);
};

onIntakeAnswer(() => applyAnswers());
useStore.subscribe((s, prev) => {
  if (s.ready && (s.supplements !== prev.supplements || s.intakes !== prev.intakes || s.skipped !== prev.skipped || s.ready !== prev.ready)) soon();
});
AppState.addEventListener('change', (st) => st === 'active' && soon());

// The daily intake reminder as a Live Activity on the Lock Screen and in the Dynamic Island, with Taken
// and Skip that work without opening the app. It appears 15 minutes before the time (or once that time
// has passed, until answered). iOS lets an app start one only while it is open on screen, so with Beyond
// closed then, the reminder notification at the time stands in for it. Answers pressed while the app was
// closed are applied when it next starts.
import { AppState } from 'react-native';

import { endIntake, intakeSlot, onIntakeAnswer, startIntake, takeIntakeAnswers } from '../modules/live-activity';
import { answered, formatDose } from './domain/supplements';
import type { Intake, Supplement } from './domain/types';
import { answerSlot } from './intakeActions';
import { soon as replanReminders } from './reminders';
import { today, useStore } from './store';

const AHEAD = 15 * 60 * 1000;

/** The first reminder time today with something unanswered, if it is due within the next 15 minutes (or already). */
export function nextSlot(
  s: { supplements: Supplement[]; intakes: Intake[]; skipped: { supplementId: string; date: string }[] },
  now = new Date(),
) {
  const date = today(now);
  const times = [...new Set(s.supplements.map((x) => x.time).filter((t): t is string => !!t))].sort();
  for (const time of times) {
    const due = s.supplements.filter((x) => x.time === time && x.createdAt.slice(0, 10) <= date && !answered(x.id, date, s.intakes, s.skipped));
    if (!due.length) continue;
    const dueAt = new Date(`${date}T${time}:00`).getTime();
    if (dueAt - now.getTime() > AHEAD) return null;
    return { date, time, slot: `${date}|${time}`, dueAt, items: due.map((x) => `${x.name} · ${formatDose(x)}`) };
  }
  return null;
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
    const next = nextSlot(useStore.getState());
    const showing = intakeSlot();
    if (!next) {
      if (showing) await endIntake(null);
      return;
    }
    // A new one can only be started with the app in front; one already up can be updated any time.
    if (AppState.currentState === 'active' || showing === next.slot) {
      await startIntake(next.items, next.dueAt, next.slot);
      // That time no longer needs its notifications.
      if (showing !== next.slot) replanReminders();
    }
  } finally {
    running = false;
  }
}

let timer: ReturnType<typeof setTimeout> | null = null;
const soon = () => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(refresh, 600);
};

// With the app open, the reminder appears on its own when the next time comes within 15 minutes.
let upcoming: ReturnType<typeof setTimeout> | null = null;
function watchNext() {
  if (upcoming) clearTimeout(upcoming);
  upcoming = null;
  const s = useStore.getState();
  if (!s.ready || AppState.currentState !== 'active') return;
  const date = today();
  const times = [...new Set(s.supplements.map((x) => x.time).filter((t): t is string => !!t))].sort();
  const now = Date.now();
  const next = times.map((t) => new Date(`${date}T${t}:00`).getTime() - AHEAD).find((at) => at > now);
  if (next) upcoming = setTimeout(() => { soon(); watchNext(); }, Math.min(next - now + 1000, 2 ** 31 - 1));
}

onIntakeAnswer(() => applyAnswers());
useStore.subscribe((s, prev) => {
  if (s.ready && (s.supplements !== prev.supplements || s.intakes !== prev.intakes || s.skipped !== prev.skipped || s.ready !== prev.ready)) soon();
});
AppState.addEventListener('change', (st) => {
  if (st === 'active') soon();
  watchNext();
});
useStore.subscribe((s, prev) => { if (s.ready && (s.supplements !== prev.supplements || s.ready !== prev.ready)) watchNext(); });

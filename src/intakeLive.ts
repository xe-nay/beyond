// The daily intake reminder as a Live Activity on the Lock Screen and in the Dynamic Island, with Taken
// and Skip that work without opening the app. iOS lets an app start one only while it is open, so it is
// started (or refreshed) whenever the app comes to the front: for the next time something is still to
// take today, up to 8 hours ahead (how long iOS keeps one running), or one already due and unanswered.
// Answers pressed while the app was closed are applied when it next starts.
import { AppState } from 'react-native';

import { endIntake, intakeSlot, onIntakeAnswer, startIntake, takeIntakeAnswers } from '../modules/live-activity';
import { answered, formatDose } from './domain/supplements';
import type { Intake, Supplement } from './domain/types';
import { answerSlot } from './intakeActions';
import { soon as replanReminders } from './reminders';
import { today, useStore } from './store';

const AHEAD = 8 * 3600 * 1000;

/** The first reminder time today with something unanswered, if it is due within the next 8 hours. */
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

onIntakeAnswer(() => applyAnswers());
useStore.subscribe((s, prev) => {
  if (s.ready && (s.supplements !== prev.supplements || s.intakes !== prev.intakes || s.skipped !== prev.skipped || s.ready !== prev.ready)) soon();
});
AppState.addEventListener('change', (st) => st === 'active' && soon());

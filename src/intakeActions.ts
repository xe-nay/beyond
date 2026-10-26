// Answering daily intake: from a reminder's buttons, the notification panel or the intake list.
import { answered } from './domain/supplements';
import { useStore } from './store';

/** Answers everything due at a reminder time: taken (ticked, counted) or skipped. Safe to repeat. */
export function answerSlot(date: string, time: string, how: 'taken' | 'skip') {
  const s = useStore.getState();
  const due = s.supplements.filter((x) => x.time === time && !answered(x.id, date, s.intakes, s.skipped));
  if (how === 'taken') for (const x of due) useStore.getState().toggleIntake(x.id, date);
  else if (due.length) s.set({ skipped: [...s.skipped, ...due.map((x) => ({ supplementId: x.id, date }))] });
}

/** Skips one supplement's dose for a day. */
export function skipIntake(supplementId: string, date: string) {
  const s = useStore.getState();
  if (!answered(supplementId, date, s.intakes, s.skipped)) s.set({ skipped: [...s.skipped, { supplementId, date }] });
}

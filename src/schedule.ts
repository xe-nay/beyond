// What is planned on a date, shared by Today, the calendar and the day screen. An imported plan takes
// over from the program for the dates it covers: until its last planned date, program days stay hidden.
import { activeProgram, type State } from './store';

const weekdayOf = (date: string) => (new Date(`${date}T12:00:00`).getDay() + 6) % 7;

/** Last date an imported plan covers, or null when nothing is imported ahead. */
export function importedUntil(s: State) {
  const dates = [
    ...s.sessions.filter((x) => x.source === 'import' && !x.startedAt).map((x) => x.date),
    ...s.cardio.filter((c) => !c.completed && c.plan && c.id.startsWith('imp-')).map((c) => c.date),
  ];
  return dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null;
}

export function plannedFor(s: State, date: string, today: string) {
  const program = activeProgram(s);
  const sessions = s.sessions.filter((x) => !x.startedAt && x.date === date);
  const until = importedUntil(s);
  const done = s.sessions.filter((x) => x.finishedAt && x.date === date);
  const programDay = date >= today && !sessions.length && (!until || date > until)
    ? program?.days.find((d) => d.weekday === weekdayOf(date) && !done.some((x) => x.dayId === d.id))
    : undefined;
  const cardio = s.cardio.filter((c) => !c.completed && c.plan && c.date === date);
  return { sessions, programDay, program, cardio, done, cardioDone: s.cardio.filter((c) => c.completed && c.date === date) };
}

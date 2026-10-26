// What is planned on a date, shared by Today, the calendar, Train and the day screen.
// - A dated (imported) workout always wins on its own date.
// - A program with a period fills only the days inside it.
// - A program without a period (older ones) stays hidden while an imported plan covers the dates,
//   and takes over after the plan's last date.
// - A rest day from an imported plan has no program workout.
import { activeProgram, type State } from './store';

const weekdayOf = (date: string) => (new Date(`${date}T12:00:00`).getDay() + 6) % 7;

/** Last date an imported plan covers, or null when nothing is imported ahead. */
export function importedUntil(s: State) {
  const dates = [
    ...s.sessions.filter((x) => x.source === 'import' && !x.startedAt).map((x) => x.date),
    ...s.cardio.filter((c) => !c.completed && c.plan && c.id.startsWith('imp-')).map((c) => c.date),
    ...s.restDays,
  ];
  return dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null;
}

/** Whether the active program plans this date at all (its period, or after an imported plan). */
export function programCovers(s: State, date: string, until = importedUntil(s)) {
  const p = activeProgram(s);
  if (!p) return false;
  if (p.from || p.until) return (!p.from || date >= p.from) && (!p.until || date <= p.until);
  return !until || date > until;
}

/** An imported plan is running: it has workouts or cardio from today on, and no program period overrides it. */
export function planActive(s: State, today: string) {
  const until = importedUntil(s);
  return !!until && until >= today && !programCovers(s, today, until);
}

export function plannedFor(s: State, date: string, today: string) {
  const program = activeProgram(s);
  const sessions = s.sessions.filter((x) => !x.startedAt && x.date === date);
  const done = s.sessions.filter((x) => x.finishedAt && x.date === date);
  // A rest day from an imported plan keeps the program off that date.
  const rest = s.restDays.includes(date);
  const programDay = date >= today && !sessions.length && !rest && programCovers(s, date)
    ? program?.days.find((d) => d.weekday === weekdayOf(date) && !done.some((x) => x.dayId === d.id))
    : undefined;
  const cardio = s.cardio.filter((c) => !c.completed && c.plan && c.date === date);
  return { sessions, programDay, program, cardio, done, rest, cardioDone: s.cardio.filter((c) => c.completed && c.date === date) };
}

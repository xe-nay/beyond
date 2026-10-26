// One dated training file for plans and history. Entries with a "performed" block become history;
// the rest become scheduled sessions. Also reads the earlier "kinetic-training" v1 files.
import { defaultImplements } from './equipment.ts';
import { paceInText, readPace } from './track.ts';
import type { CardioSession, Exercise, IntervalPlan, Prescription, Session, WorkoutSet } from './types.ts';

/** Something already in the app on the same date and of the same type as an imported entry. */
export interface Clash { id: string; name: string; kind: 'plan' | 'history' }
export interface ImportRow {
  id: string; // id the entry gets in the app
  date: string;
  name: string;
  type: 'strength' | 'cardio' | 'rest';
  kind: 'plan' | 'history';
  status: 'new' | 'same' | 'changed'; // changed: this entry was imported before and differs now
  clashes: Clash[];
}

export interface ImportResult {
  sessions: Session[];
  cardio: CardioSession[];
  rows: ImportRow[];
  errors: string[];
  rest: string[]; // dates the file marks as rest days
  period: { from: string; until: string } | null; // first and last date in the file
  /** What the app already plans inside the period (not started), which "replace" removes. */
  plannedInPeriod: { id: string; date: string; name: string; type: 'strength' | 'cardio' }[];
  /** Workouts and cardio already done inside the period; always kept. */
  doneInPeriod: number;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Everyday names that would otherwise land on a variant. */
const ALIASES: Record<string, string> = {
  'squat': 'squat', 'back-squat': 'squat', 'deadlift': 'deadlift', 'bench': 'bench-press', 'bench-press': 'bench-press',
  'overhead-press': 'ohp', 'military-press': 'ohp', 'shoulder-press': 'ohp', 'ohp': 'ohp',
  'barbell-row': 'barbell-row', 'bent-over-row': 'barbell-row', 'row': 'barbell-row',
  'hip-thrust': 'hip-thrust', 'bicep-curl': 'bicep-curl', 'biceps-curl': 'bicep-curl', 'curl': 'bicep-curl',
  'dip': 'dips', 'dips': 'dips', 'chin-up': 'chin-ups', 'chin-ups': 'chin-ups', 'calf-raise': 'machine-calf-raise',
  'lateral-raise': 'lateral-raise', 'lateral-raises': 'lateral-raise', 'side-lateral-raise': 'lateral-raise',
  'pull-up': 'pull-up', 'pull-ups': 'pull-up', 'pullups': 'pull-up', 'push-up': 'push-up', 'push-ups': 'push-up', 'pushups': 'push-up',
};

const words = (s: string) => slug(s).split('-').filter(Boolean).map((w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w));

/** Finds an exercise by our id, a free-exercise-db id, its name, or failing that the shortest name holding every word ("bench press" → Barbell Bench Press). */
export function resolver(all: Exercise[]) {
  const byId = new Map(all.map((e) => [e.id, e]));
  const byName = new Map(all.map((e) => [slug(e.name), e]));
  const indexed = all.map((e) => ({ e, w: words(e.name) }));
  // Extra words cost 1 each; a plain equipment word costs less, and the main catalog wins ties.
  const cost = (w: string[], want: string[], id: string) =>
    w.filter((x) => !want.includes(x)).reduce((n, x) => n + (x === 'barbell' ? 0.3 : x === 'dumbbell' ? 0.5 : 1), 0) + (id.startsWith('f-') ? 0.1 : 0);
  return (ref: string) => {
    const key = ALIASES[slug(ref)] ?? ref;
    const hit = byId.get(key) ?? byId.get(slug(key)) ?? byId.get(`f-${slug(key)}`) ?? byName.get(slug(key));
    if (hit) return hit;
    const want = words(key);
    if (!want.length) return null;
    let best: { e: Exercise; c: number } | null = null;
    for (const x of indexed) {
      if (!want.every((w) => x.w.includes(w))) continue;
      const c = cost(x.w, want, x.e.id);
      if (!best || c < best.c) best = { e: x.e, c };
    }
    return best?.e ?? null;
  };
}

/** The cardio activities the app knows, and everyday words for them. */
export const CARDIO_ACTIVITIES = ['Running', 'Walking', 'Cycling', 'Rowing', 'Swimming', 'Elliptical', 'Stairs', 'HIIT'] as const;
const ACTIVITY_WORDS: Record<string, (typeof CARDIO_ACTIVITIES)[number]> = {
  run: 'Running', running: 'Running', jog: 'Running', jogging: 'Running', 'run-walk': 'Running', treadmill: 'Running',
  walk: 'Walking', walking: 'Walking', hike: 'Walking', hiking: 'Walking',
  cycle: 'Cycling', cycling: 'Cycling', bike: 'Cycling', biking: 'Cycling', spin: 'Cycling',
  row: 'Rowing', rowing: 'Rowing', rower: 'Rowing', swim: 'Swimming', swimming: 'Swimming',
  elliptical: 'Elliptical', 'cross-trainer': 'Elliptical', stairs: 'Stairs', stair: 'Stairs', 'stair-climber': 'Stairs', stairmaster: 'Stairs',
  hiit: 'HIIT', circuit: 'HIIT',
};

const PHASES = ['warmup', 'work', 'recovery', 'cooldown'] as const;

/** An "intervals" block as a plan, or a sentence saying what is wrong with it. */
export function readIntervals(iv: any): IntervalPlan | string {
  const name = String(iv.activityType ?? iv.activity ?? 'Running');
  const activity = CARDIO_ACTIVITIES.find((a) => a.toLowerCase() === name.toLowerCase()) ?? ACTIVITY_WORDS[slug(name)];
  if (!activity) return `activityType "${name}" is not one of ${CARDIO_ACTIVITIES.join(', ')}.`;
  // Seconds, or the same field in minutes ("warmupMinutes": 5).
  const time = (key: string, lo: number, hi: number): number | string => {
    const v = iv[`${key}Seconds`] ?? (iv[`${key}Minutes`] !== undefined ? +iv[`${key}Minutes`] * 60 : undefined);
    if (v === undefined || v === null) return 0;
    const n = Math.round(+v);
    return Number.isFinite(n) && n >= lo && n <= hi ? n : `${key}Seconds must be a number from ${lo} to ${hi}.`;
  };
  const warmupSeconds = time('warmup', 0, 3600);
  const workSeconds = time('work', 5, 14400);
  const recoverySeconds = time('recovery', 0, 3600);
  const cooldownSeconds = time('cooldown', 0, 3600);
  for (const v of [warmupSeconds, workSeconds, recoverySeconds, cooldownSeconds]) if (typeof v === 'string') return v;
  if (!workSeconds) return 'cardio needs workSeconds (or workMinutes).';
  const rounds = iv.rounds === undefined ? 1 : Math.round(+iv.rounds);
  if (!Number.isFinite(rounds) || rounds < 1 || rounds > 50) return 'rounds must be a whole number from 1 to 50.';
  const countdown = iv.countdownSeconds ?? iv.countdown ?? 5;
  if (!Number.isFinite(+countdown) || +countdown < 0 || +countdown > 30) return 'countdownSeconds must be 0 to 30.';
  const unit = String(iv.paceUnit ?? 'km').toLowerCase().startsWith('mi') ? 'mi' : 'km';

  const plan: IntervalPlan = {
    activity, warmupSeconds: warmupSeconds as number, workSeconds: workSeconds as number, recoverySeconds: recoverySeconds as number,
    rounds, cooldownSeconds: cooldownSeconds as number,
    workCue: String(iv.workCue ?? ''), recoveryCue: String(iv.recoveryCue ?? ''),
    ...(iv.warmupCue ? { warmupCue: String(iv.warmupCue) } : {}), ...(iv.cooldownCue ? { cooldownCue: String(iv.cooldownCue) } : {}),
    countdown: Math.round(+countdown),
    ...(unit === 'mi' ? { paceUnit: 'mi' as const } : {}),
  };
  for (const k of PHASES) {
    const raw = iv[`${k}Pace`];
    // A number is seconds per km; text without a unit takes the paceUnit.
    const text = typeof raw === 'string' && unit === 'mi' && !/\/|per/i.test(raw) ? `${raw} /mi` : raw;
    // Without a pace field, a pace written in the cue ("Easy walk 10:00–12:00 min/km") counts.
    const pace = readPace(text) ?? paceInText(iv[`${k}Cue`]);
    if (readPace(text) === undefined) return `${k}Pace ${JSON.stringify(raw)} is not a pace. Write "7:30", "7:15-8:15" or "7:30 /km".`;
    if (pace) plan[`${k}Pace`] = pace;
  }
  return plan;
}

export function parseTrainingFile(text: string, all: Exercise[], existing: { sessions: Session[]; cardio: CardioSession[] }): ImportResult {
  const out: ImportResult = { sessions: [], cardio: [], rows: [], errors: [], rest: [], period: null, plannedInPeriod: [], doneInPeriod: 0 };
  let file: any;
  try {
    // Tolerates a reply pasted from a chat: code fences or a sentence around the JSON.
    const a = text.indexOf('{');
    const b = text.lastIndexOf('}');
    file = JSON.parse(a >= 0 && b > a ? text.slice(a, b + 1) : text);
  } catch {
    return { ...out, errors: ['The file is not valid JSON.'] };
  }
  if (!['beyond-training', 'kinetic-training'].includes(file?.format) || file?.version !== 1)
    return { ...out, errors: ['Unknown format. Expected "beyond-training", version 1.'] };
  if (!Array.isArray(file.entries) || !file.entries.length) return { ...out, errors: ['The file has no entries.'] };

  const find = resolver(all);
  const ids = new Set<string>();
  const today = new Date().toISOString().slice(0, 10);
  const fileId = String(file.id ?? 'import');

  file.entries.forEach((entry: any, i: number) => {
    const where = `Entry ${i + 1}${entry?.name ? ` (${entry.name})` : ''}`;
    if (!entry?.id || ids.has(entry.id)) return out.errors.push(`${where}: missing or duplicate id.`);
    ids.add(entry.id);
    if (!DATE.test(entry.date ?? '') || Number.isNaN(Date.parse(entry.date))) return out.errors.push(`${where}: date must be YYYY-MM-DD.`);
    const type = entry.type ?? 'strength';
    if (type !== 'strength' && type !== 'cardio' && type !== 'rest') return out.errors.push(`${where}: type must be "strength", "cardio" or "rest".`);
    const done = !!entry.performed;
    if (done && entry.date > today) return out.errors.push(`${where}: a future date cannot have results.`);
    const id = `imp-${fileId}-${entry.id}`;

    if (type === 'rest') {
      if (done) return out.errors.push(`${where}: a rest day has no results.`);
      out.rest.push(entry.date);
      out.rows.push({ id, date: entry.date, name: entry.name ?? 'Rest day', type: 'rest', kind: 'plan', status: 'new', clashes: [] });
      return;
    }

    if (type === 'cardio') {
      const read = readIntervals(entry.intervals ?? {});
      if (typeof read === 'string') return out.errors.push(`${where}: ${read}`);
      const plan = read;
      const p = entry.performed;
      const c: CardioSession = {
        id, date: entry.date, activity: plan.activity, plan, notes: entry.notes ?? '', ...(entry.name ? { name: String(entry.name) } : {}),
        // Without minutes, a finished session counts its planned length.
        minutes: done && +p.minutes > 0 ? +p.minutes : Math.round((plan.warmupSeconds + plan.rounds * plan.workSeconds + (plan.rounds - 1) * plan.recoverySeconds + plan.cooldownSeconds) / 60),
        distanceKm: done ? p.distanceKm ?? null : null,
        rpe: done ? p.rpe ?? null : null,
        avgHr: done ? p.avgHr ?? null : null,
        completed: done,
      };
      const prev = existing.cardio.find((x) => x.id === id);
      const clashes = existing.cardio.filter((x) => x.id !== id && x.date === c.date).map((x) => ({ id: x.id, name: x.activity, kind: x.completed ? 'history' as const : 'plan' as const }));
      out.cardio.push(c);
      out.rows.push({ id, date: c.date, name: entry.name ?? c.activity, type: 'cardio', kind: done ? 'history' : 'plan', status: !prev ? 'new' : JSON.stringify(prev) === JSON.stringify(c) ? 'same' : 'changed', clashes });
      return;
    }

    if (!entry.exercises?.length && !entry.performed?.sets?.length) return out.errors.push(`${where}: a workout needs "exercises" or performed "sets".`);
    const plan: Prescription[] = [];
    for (const x of entry.exercises ?? []) {
      const e = find(x.exerciseId ?? x.name ?? '');
      if (!e) return out.errors.push(`${where}: unknown exercise "${x.exerciseId ?? x.name}".`);
      const minReps = clamp(+x.minReps || 8, 1, 50);
      plan.push({
        exerciseId: e.id,
        sets: clamp(+x.sets || 3, 1, 10),
        minReps,
        maxReps: clamp(+x.maxReps || +x.minReps || 12, minReps, 50),
        rir: clamp(x.rir ?? 2, 0, 5),
        restSeconds: clamp(+x.restSeconds || 120, 15, 600),
        loadKg: x.loadKg ?? null,
        warmupSets: clamp(+x.warmupSets || 0, 0, 5),
        superset: x.superset || undefined,
      });
    }
    let sets: WorkoutSet[] = [];
    if (done) {
      const p = entry.performed;
      sets = (p.sets ?? []).map((s: any, n: number) => {
        const e = find(s.exerciseId ?? s.name ?? '');
        return e && {
          id: `${id}-s${n}`, exerciseId: e.id, reps: +s.reps || 0, loadKg: +s.loadKg || 0, rir: typeof s.rir === 'number' ? clamp(s.rir, 0, 10) : null, implements: s.implements === 1 || s.implements === 2 ? s.implements : defaultImplements(e),
          warmup: !!s.warmup, completedAt: s.completedAt ?? `${entry.date}T12:00:00Z`, restSeconds: s.actualRestSeconds ?? null,
        };
      });
      if (sets.some((s) => !s)) return out.errors.push(`${where}: a performed set names an unknown exercise.`);
    }
    const session: Session = {
      id, programId: null, dayId: null, name: entry.name ?? 'Imported session', date: entry.date, plan, sets,
      startedAt: done ? entry.performed.startedAt ?? `${entry.date}T12:00:00Z` : null,
      finishedAt: done ? entry.performed.finishedAt ?? `${entry.date}T13:00:00Z` : null,
      sessionRpe: done ? entry.performed.sessionRpe ?? null : null,
      notes: entry.notes ?? '', source: 'import',
    };
    const prev = existing.sessions.find((x) => x.id === id);
    if (prev && prev.startedAt && !prev.finishedAt) return out.errors.push(`${where}: already in progress in the app.`);
    out.sessions.push(session);
    // Sessions on that date that hold something: logged sets, a finished workout or a plan.
    const clashes = existing.sessions
      .filter((x) => x.id !== id && x.date === session.date && !(x.startedAt && !x.finishedAt) && (x.sets.length || x.finishedAt || !x.startedAt))
      .map((x) => ({ id: x.id, name: x.name, kind: x.finishedAt || x.sets.length ? 'history' as const : 'plan' as const }));
    out.rows.push({ id, date: session.date, name: session.name, type: 'strength', kind: done ? 'history' : 'plan', status: !prev ? 'new' : JSON.stringify(prev) === JSON.stringify(session) ? 'same' : 'changed', clashes });
  });

  out.rows.sort((a, b) => a.date.localeCompare(b.date));
  if (out.rows.length) {
    const from = out.rows[0].date;
    const until = out.rows[out.rows.length - 1].date;
    out.period = { from, until };
    const ids = new Set(out.rows.map((r) => r.id));
    const inside = (d: string) => d >= from && d <= until;
    out.plannedInPeriod = [
      ...existing.sessions.filter((x) => inside(x.date) && !x.startedAt && !ids.has(x.id)).map((x) => ({ id: x.id, date: x.date, name: x.name, type: 'strength' as const })),
      ...existing.cardio.filter((c) => inside(c.date) && !c.completed && !ids.has(c.id)).map((c) => ({ id: c.id, date: c.date, name: c.name ?? c.activity, type: 'cardio' as const })),
    ];
    out.doneInPeriod = existing.sessions.filter((x) => inside(x.date) && x.finishedAt).length + existing.cardio.filter((c) => inside(c.date) && c.completed).length;
  }
  return out;
}

/** Every date from `from` to `until`, both included. */
export function datesBetween(from: string, until: string) {
  const out: string[] = [];
  for (let d = new Date(`${from}T12:00:00Z`); d.toISOString().slice(0, 10) <= until; d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10));
  return out;
}

export type Choice = 'mine' | 'import' | 'both';
/** A row needs a decision when it would overwrite or sit next to something already logged. */
export const needsChoice = (r: ImportRow) => r.type !== 'rest' && (r.status === 'changed' || (r.status === 'new' && r.clashes.length > 0));

/**
 * What to add and what to remove.
 * - keep: the app's plans stay; each conflicting day follows its choice (default: keep mine).
 * - replace: everything planned in the file's period goes and the file's plan takes its place; days
 *   with nothing in the file become rest days. Logged workouts always stay.
 */
export function applyChoices(result: ImportResult, choices: Record<string, Choice>, mode: 'keep' | 'replace' = 'keep') {
  if (mode === 'replace' && result.period) {
    const busy = new Set(result.rows.filter((r) => r.type !== 'rest').map((r) => r.date));
    return {
      sessions: result.sessions,
      cardio: result.cardio,
      remove: result.plannedInPeriod.map((x) => x.id),
      rest: { ...result.period, days: datesBetween(result.period.from, result.period.until).filter((d) => !busy.has(d)) },
    };
  }
  const take = new Set<string>();
  const remove = new Set<string>();
  for (const r of result.rows) {
    if (r.type === 'rest') continue;
    if (r.status === 'same') continue;
    const c = needsChoice(r) ? choices[r.id] ?? 'mine' : 'import';
    if (c === 'mine') continue;
    take.add(r.id);
    if (c === 'import') r.clashes.forEach((x) => remove.add(x.id));
  }
  return {
    sessions: result.sessions.filter((x) => take.has(x.id)),
    cardio: result.cardio.filter((x) => take.has(x.id)),
    remove: [...remove],
    rest: { from: null, until: null, days: result.rest },
  };
}

/** A blank week template from a program, to edit and re-import. */
export function weekTemplate(name: string, start: Date, days: { weekday: number; name: string; exercises: Prescription[] }[]) {
  return {
    format: 'beyond-training',
    version: 1,
    id: `week-${start.toISOString().slice(0, 10)}`,
    name,
    entries: days.map((d) => {
      const date = new Date(start);
      date.setDate(date.getDate() + d.weekday);
      return {
        id: `${slug(d.name)}-${date.toISOString().slice(0, 10)}`,
        date: date.toISOString().slice(0, 10),
        name: d.name,
        type: 'strength',
        exercises: d.exercises.map(({ exerciseId, sets, minReps, maxReps, rir, restSeconds, loadKg }) => ({ exerciseId, sets, minReps, maxReps, rir, restSeconds, loadKg })),
      };
    }),
  };
}

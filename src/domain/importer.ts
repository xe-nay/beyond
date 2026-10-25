// One dated training file for plans and history. Entries with a "performed" block become history;
// the rest become scheduled sessions. Also reads the earlier "kinetic-training" v1 files.
import type { CardioSession, Exercise, IntervalPlan, Prescription, Session, WorkoutSet } from './types.ts';

/** Something already in the app on the same date and of the same type as an imported entry. */
export interface Clash { id: string; name: string; kind: 'plan' | 'history' }
export interface ImportRow {
  id: string; // id the entry gets in the app
  date: string;
  name: string;
  type: 'strength' | 'cardio';
  kind: 'plan' | 'history';
  status: 'new' | 'same' | 'changed'; // changed: this entry was imported before and differs now
  clashes: Clash[];
}

export interface ImportResult {
  sessions: Session[];
  cardio: CardioSession[];
  rows: ImportRow[];
  errors: string[];
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
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

export function parseTrainingFile(text: string, all: Exercise[], existing: { sessions: Session[]; cardio: CardioSession[] }): ImportResult {
  const out: ImportResult = { sessions: [], cardio: [], rows: [], errors: [] };
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
    const done = !!entry.performed;
    if (done && entry.date > today) return out.errors.push(`${where}: a future date cannot have results.`);
    const id = `imp-${fileId}-${entry.id}`;

    if (entry.type === 'cardio') {
      const iv = entry.intervals ?? {};
      const plan: IntervalPlan = {
        activity: iv.activityType ?? iv.activity ?? 'Running',
        warmupSeconds: +iv.warmupSeconds || 0,
        workSeconds: +iv.workSeconds || 0,
        recoverySeconds: +iv.recoverySeconds || 0,
        rounds: Math.max(1, +iv.rounds || 1),
        cooldownSeconds: +iv.cooldownSeconds || 0,
        workCue: iv.workCue ?? '',
        recoveryCue: iv.recoveryCue ?? '',
        countdown: Math.min(30, Math.max(0, iv.countdownSeconds ?? iv.countdown ?? 5)),
      };
      if (!plan.workSeconds) return out.errors.push(`${where}: cardio needs workSeconds.`);
      const p = entry.performed;
      const c: CardioSession = {
        id, date: entry.date, activity: plan.activity, plan, notes: entry.notes ?? '',
        minutes: done ? +p.minutes || 0 : Math.round((plan.warmupSeconds + plan.rounds * plan.workSeconds + (plan.rounds - 1) * plan.recoverySeconds + plan.cooldownSeconds) / 60),
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

    const plan: Prescription[] = [];
    for (const x of entry.exercises ?? []) {
      const e = find(x.exerciseId ?? x.name ?? '');
      if (!e) return out.errors.push(`${where}: unknown exercise "${x.exerciseId ?? x.name}".`);
      plan.push({
        exerciseId: e.id,
        sets: Math.min(10, Math.max(1, +x.sets || 3)),
        minReps: +x.minReps || 8,
        maxReps: +x.maxReps || +x.minReps || 12,
        rir: x.rir ?? 2,
        restSeconds: Math.min(600, Math.max(15, +x.restSeconds || 120)),
        loadKg: x.loadKg ?? null,
        warmupSets: x.warmupSets ?? 0,
        superset: x.superset || undefined,
      });
    }
    let sets: WorkoutSet[] = [];
    if (done) {
      const p = entry.performed;
      sets = (p.sets ?? []).map((s: any, n: number) => {
        const e = find(s.exerciseId ?? s.name ?? '');
        return e && {
          id: `${id}-s${n}`, exerciseId: e.id, reps: +s.reps || 0, loadKg: +s.loadKg || 0, rir: s.rir ?? null, implements: s.implements === 2 ? 2 : undefined,
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
  return out;
}

export type Choice = 'mine' | 'import' | 'both';
/** A row needs a decision when it would overwrite or sit next to something already logged. */
export const needsChoice = (r: ImportRow) => r.status === 'changed' || (r.status === 'new' && r.clashes.length > 0);

/** What to add and what to remove, given the user's choice for each conflicting row (default: keep mine). */
export function applyChoices(result: ImportResult, choices: Record<string, Choice>) {
  const take = new Set<string>();
  const remove = new Set<string>();
  for (const r of result.rows) {
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

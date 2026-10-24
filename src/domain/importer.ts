// One dated training file for plans and history. Entries with a "performed" block become history;
// the rest become scheduled sessions. Also reads the earlier "kinetic-training" v1 files.
import type { CardioSession, Exercise, IntervalPlan, Prescription, Session, WorkoutSet } from './types.ts';

export interface ImportResult {
  sessions: Session[];
  cardio: CardioSession[];
  rows: { date: string; name: string; type: 'strength' | 'cardio'; kind: 'plan' | 'history'; status: 'new' | 'same' }[];
  errors: string[];
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Finds an exercise by our id, a free-exercise-db id, or its name. */
export function resolver(all: Exercise[]) {
  const byId = new Map(all.map((e) => [e.id, e]));
  const byName = new Map(all.map((e) => [slug(e.name), e]));
  return (ref: string) => byId.get(ref) ?? byId.get(`f-${slug(ref)}`) ?? byName.get(slug(ref)) ?? null;
}

export function parseTrainingFile(text: string, all: Exercise[], existing: { sessions: Session[]; cardio: CardioSession[] }): ImportResult {
  const out: ImportResult = { sessions: [], cardio: [], rows: [], errors: [] };
  let file: any;
  try {
    file = JSON.parse(text);
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
      const same = existing.cardio.some((x) => x.id === id && JSON.stringify(x) === JSON.stringify(c));
      out.cardio.push(c);
      out.rows.push({ date: c.date, name: entry.name ?? c.activity, type: 'cardio', kind: done ? 'history' : 'plan', status: same ? 'same' : 'new' });
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
        const e = find(s.exerciseId ?? '');
        return e && {
          id: `${id}-s${n}`, exerciseId: e.id, reps: +s.reps || 0, loadKg: +s.loadKg || 0, rir: s.rir ?? null,
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
    out.rows.push({ date: session.date, name: session.name, type: 'strength', kind: done ? 'history' : 'plan', status: prev && JSON.stringify(prev) === JSON.stringify(session) ? 'same' : 'new' });
  });

  out.rows.sort((a, b) => a.date.localeCompare(b.date));
  return out;
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

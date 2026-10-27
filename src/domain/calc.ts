// Training calculations. Each one is deterministic and states its assumptions in the UI.
import type { Exercise, Prescription, RecoveryCheck, Region, Session, WorkoutSet } from './types.ts';

export const REGIONS: Region[] = [
  'chest', 'deltoids', 'biceps', 'triceps', 'forearm', 'abs', 'obliques', 'trapezius',
  'upper-back', 'lower-back', 'gluteal', 'quadriceps', 'hamstring', 'adductors', 'calves',
  'tibialis', 'neck',
];

export const REGION_NAMES: Record<Region, string> = {
  chest: 'Chest', deltoids: 'Shoulders', biceps: 'Biceps', triceps: 'Triceps', forearm: 'Forearms',
  abs: 'Abs', obliques: 'Obliques', trapezius: 'Traps', 'upper-back': 'Upper back',
  'lower-back': 'Lower back', gluteal: 'Glutes', quadriceps: 'Quads', hamstring: 'Hamstrings',
  adductors: 'Adductors', calves: 'Calves', tibialis: 'Shins', neck: 'Neck',
};

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
export const working = (sets: WorkoutSet[]) => sets.filter((s) => !s.warmup);

/** Epley estimate, trusted only up to 10 reps; a single is its own 1RM. */
export function e1rm(loadKg: number, reps: number): number | null {
  if (!(loadKg > 0) || !Number.isInteger(reps) || reps < 1 || reps > 10) return null;
  return reps === 1 ? loadKg : loadKg * (1 + reps / 30);
}

/** Effort-adjusted estimate: reps actually possible = reps + RIR. */
export function e1rmWithRir(loadKg: number, reps: number, rir: number | null) {
  return e1rm(loadKg, Math.min(10, reps + (rir ?? 0)));
}

/**
 * The weight that should leave `targetRir` reps in reserve after `targetReps`, from a set already done
 * with its RIR. Reps possible = reps + RIR (the RIR-based RPE scale, Zourdos et al. 2016; Helms et al.
 * 2016), and load scales with reps possible as in Epley, which is how RPE charts such as the RTS table
 * are used: estimate the max from one set, then work back to the next. Trusted up to 15 reps possible on
 * both sides; null otherwise or without an RIR.
 */
export function loadForRir(set: { loadKg: number; reps: number; rir: number | null }, targetReps: number, targetRir: number) {
  if (set.rir === null || !(set.loadKg > 0) || set.reps < 1 || targetReps < 1) return null;
  const done = set.reps + set.rir;
  const want = targetReps + targetRir;
  if (done > 15 || want > 15) return null;
  return (set.loadKg * (1 + done / 30)) / (1 + want / 30);
}

/** RPE on the RIR-based scale (Zourdos et al. 2016): RPE = 10 − RIR, for RIR 0–4. */
export const rirToRpe = (rir: number | null) => (rir === null || rir < 0 || rir > 4 ? null : 10 - rir);

/** Total load moved in a set: two 20 kg dumbbells count as 40 kg. */
export const totalLoad = (s: WorkoutSet) => s.loadKg * (s.implements ?? 1) + (s.bodyKg ?? 0);
/** The weight shown for a set: per dumbbell or kettlebell, and with the body weight a bodyweight exercise moves. */
export const setKg = (s: Pick<WorkoutSet, 'loadKg' | 'bodyKg'>) => s.loadKg + (s.bodyKg ?? 0);
export const volumeLoad = (sets: WorkoutSet[]) => working(sets).reduce((n, s) => n + totalLoad(s) * s.reps, 0);
export const totalReps = (sets: WorkoutSet[]) => working(sets).reduce((n, s) => n + s.reps, 0);

export function effortSummary(sets: WorkoutSet[]) {
  const work = working(sets);
  const rated = work.filter((s) => s.rir !== null);
  return {
    sets: work.length,
    reps: totalReps(sets),
    rated: rated.length,
    averageRir: avg(rated.map((s) => s.rir!)),
    nearFailure: rated.filter((s) => s.rir! <= 1).length,
    coverage: work.length ? rated.length / work.length : 0,
  };
}

/** Rep drop from the first to the last working set at the same load: a within-session fatigue signal. */
export function repDrop(sets: WorkoutSet[]) {
  const work = working(sets);
  if (work.length < 2 || work.some((s) => s.loadKg !== work[0].loadKg)) return null;
  const first = work[0].reps;
  const last = work[work.length - 1].reps;
  return { first, last, percent: first ? ((last - first) / first) * 100 : 0 };
}

/** Fatigue index across one exercise's sets: % loss in volume per set from best to last. */
export function fatigueIndex(sets: WorkoutSet[]) {
  const work = working(sets);
  if (work.length < 2) return null;
  const vols = work.map((s) => totalLoad(s) * s.reps || s.reps);
  const best = Math.max(...vols);
  return best ? ((best - vols[vols.length - 1]) / best) * 100 : null;
}

export function sessionMinutes(s: Session) {
  if (!s.startedAt || !s.finishedAt) return null;
  const m = (Date.parse(s.finishedAt) - Date.parse(s.startedAt)) / 60000;
  return m > 0 ? m : null;
}

/** Foster's session-RPE load: minutes × session RPE (arbitrary units). */
export function sessionLoad(s: Session) {
  const m = sessionMinutes(s);
  return m && s.sessionRpe ? m * s.sessionRpe : null;
}

const DAY = 86400000;
const within = (s: Session, from: number, to: number) => {
  const t = Date.parse(s.finishedAt ?? '');
  return t >= from && t < to;
};

export interface Signal { label: string; basis: string; level: 'watch' | 'high' }

/** Seven-day fatigue review built from recorded sets and the latest check-in. */
export function fatigueReport(sessions: Session[], checks: RecoveryCheck[], now = Date.now()) {
  const recent = sessions.filter((s) => within(s, now - 7 * DAY, now + 1));
  const prior = sessions.filter((s) => within(s, now - 35 * DAY, now - 7 * DAY));
  const effort = effortSummary(recent.flatMap((s) => s.sets));
  const priorWeekly = working(prior.flatMap((s) => s.sets)).length / 4;
  const signals: Signal[] = [];

  if (effort.rated >= 6 && effort.nearFailure / effort.rated >= 0.5)
    signals.push({ label: 'Many sets near failure', basis: `${effort.nearFailure} of ${effort.rated} rated sets at 0–1 RIR`, level: 'watch' });
  if (priorWeekly >= 6 && effort.sets >= priorWeekly * 1.3)
    signals.push({ label: 'Workload jump', basis: `${effort.sets} sets vs ${Math.round(priorWeekly)}/week before (+${Math.round((effort.sets / priorWeekly - 1) * 100)}%)`, level: 'watch' });

  const drops = recent.flatMap((s) => groupByExercise(s.sets).map((g) => repDrop(g.sets))).filter(Boolean) as { percent: number }[];
  const meanDrop = avg(drops.map((d) => d.percent));
  if (drops.length >= 3 && meanDrop !== null && meanDrop <= -25)
    signals.push({ label: 'Reps falling across sets', basis: `Average ${Math.round(meanDrop)}% from first to last set`, level: 'watch' });

  const check = [...checks].sort((a, b) => b.date.localeCompare(a.date))[0];
  const fresh = check && now - Date.parse(`${check.date}T00:00:00`) < 2 * DAY ? check : null;
  if (fresh?.energy !== undefined && fresh.energy <= 2) signals.push({ label: 'Low energy', basis: `${fresh.energy}/5 on ${fresh.date}`, level: 'watch' });
  if (fresh && fresh.soreness >= 4) signals.push({ label: 'High soreness', basis: `${fresh.soreness}/5 on ${fresh.date}`, level: 'watch' });
  if (fresh && fresh.sleepHours < 6) signals.push({ label: 'Short sleep', basis: `${fresh.sleepHours} h on ${fresh.date}`, level: 'watch' });

  const loads = recent.map(sessionLoad).filter((x): x is number => x !== null);
  const score = Math.min(100, signals.length * 25 + (effort.coverage ? effort.nearFailure * 2 : 0));
  return {
    recent: recent.length,
    effort,
    priorWeekly,
    meanDrop,
    check: fresh,
    signals,
    weeklyLoad: loads.reduce((a, b) => a + b, 0),
    score,
    status: !recent.length && !fresh ? 'Not enough data' : signals.length >= 2 ? 'Ease off' : signals.length ? 'Watch' : 'Ready',
  };
}

export function groupByExercise(sets: WorkoutSet[]) {
  const map = new Map<string, WorkoutSet[]>();
  for (const s of sets) map.set(s.exerciseId, [...(map.get(s.exerciseId) ?? []), s]);
  return [...map].map(([exerciseId, list]) => ({ exerciseId, sets: list }));
}

/** Weekly sets per region: a primary target counts 1 set, a secondary 0.5 (an approximation). */
export function regionSets(sessions: Session[], byId: Record<string, Exercise>, secondary = 0.5) {
  const out = Object.fromEntries(REGIONS.map((r) => [r, 0])) as Record<Region, number>;
  for (const s of sessions)
    for (const set of working(s.sets)) {
      const e = byId[set.exerciseId];
      if (!e) continue;
      e.primary.forEach((r) => (out[r] += 1));
      e.secondary.forEach((r) => (out[r] += secondary));
    }
  return out;
}

export function weekStart(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

export function weeklySeries(sessions: Session[], weeks = 8, now = new Date()) {
  const start = weekStart(now).getTime();
  return Array.from({ length: weeks }, (_, i) => {
    const from = start - (weeks - 1 - i) * 7 * DAY;
    const ss = sessions.filter((s) => within(s, from, from + 7 * DAY));
    return {
      from,
      sessions: ss.length,
      sets: ss.reduce((n, s) => n + working(s.sets).length, 0),
      volume: Math.round(ss.reduce((n, s) => n + volumeLoad(s.sets), 0)),
    };
  });
}

/** Best estimated 1RM per finished session for one exercise. */
export function strengthTrend(sessions: Session[], exerciseId: string) {
  return sessions
    .filter((s) => s.finishedAt)
    .sort((a, b) => a.finishedAt!.localeCompare(b.finishedAt!))
    .flatMap((s) => {
      const v = working(s.sets).filter((x) => x.exerciseId === exerciseId).map((x) => strength(totalLoad(x), x.reps)).filter((x) => x > 0);
      return v.length ? [{ date: s.date, value: Math.max(...v) }] : [];
    });
}

export function bestSet(sessions: Session[], exerciseId: string, before?: string) {
  let best: { set: WorkoutSet; e1rm: number } | null = null;
  for (const s of sessions) {
    if (before && s.date >= before) continue;
    for (const set of working(s.sets)) {
      if (set.exerciseId !== exerciseId) continue;
      const v = e1rm(totalLoad(set), set.reps);
      if (v && (!best || v > best.e1rm)) best = { set, e1rm: v };
    }
  }
  return best;
}

/** Sets from the most recent finished session that included the exercise. */
export function previousSets(sessions: Session[], exerciseId: string, excludeId?: string) {
  const last = sessions
    .filter((s) => s.finishedAt && s.id !== excludeId && s.sets.some((x) => x.exerciseId === exerciseId))
    .sort((a, b) => b.finishedAt!.localeCompare(a.finishedAt!))[0];
  return last ? working(last.sets).filter((x) => x.exerciseId === exerciseId) : [];
}

export interface Advice { kind: 'increase' | 'reps' | 'hold' | 'reduce' | 'start'; title: string; basis: string; nextKg: number | null }

/**
 * Double progression: add load after every set reaches the top of the range at or above the target RIR,
 * twice in a row. Bodyweight exercises (`bw`) start from reps, and load is added with a vest or belt.
 */
export function progression(sessions: Session[], p: Prescription, stepKg = 2.5, bw = false): Advice {
  const recent = sessions
    .filter((s) => s.finishedAt && working(s.sets).some((x) => x.exerciseId === p.exerciseId))
    .sort((a, b) => b.finishedAt!.localeCompare(a.finishedAt!))
    .slice(0, 2)
    .map((s) => working(s.sets).filter((x) => x.exerciseId === p.exerciseId));
  if (!recent.length) {
    return bw
      ? { kind: 'start', title: 'Find your reps', basis: `Do clean reps up to ${p.maxReps}, stopping with about ${p.rir} left.`, nextKg: p.loadKg }
      : { kind: 'start', title: 'Find your working weight', basis: `Pick a load you can lift ${p.maxReps} times with about ${p.rir} reps left.`, nextKg: p.loadKg };
  }
  const last = recent[0];
  const load = last[0].loadKg;
  const kg = (n: number) => (bw ? (n > 0 ? `+${n} kg` : 'body weight') : `${n} kg`);
  const top = (sets: WorkoutSet[]) => sets.length >= p.sets && sets.every((x) => x.reps >= p.maxReps && (x.rir ?? 0) >= p.rir && x.loadKg === load);
  if (recent.length === 2 && recent.every(top))
    return { kind: 'increase', title: bw ? `Add ${stepKg} kg (vest or belt) or a harder variation` : `Go up to ${load + stepKg} kg`, basis: `Two sessions with all ${p.sets} sets at ${p.maxReps}+ reps and ${p.rir}+ RIR at ${kg(load)}.`, nextKg: load + stepKg };
  const failed = last.filter((x) => x.reps < p.minReps).length;
  if (failed >= Math.ceil(last.length / 2))
    return { kind: 'reduce', title: bw && load <= 0 ? 'Hold, or use an easier variation' : `Hold or drop to ${kg(Math.max(0, load - stepKg))}`, basis: `${failed} of ${last.length} sets fell below ${p.minReps} reps last time.`, nextKg: Math.max(0, load - stepKg) };
  return { kind: 'reps', title: `Stay at ${kg(load)}, add reps`, basis: `Aim for ${p.maxReps} reps on every set before adding load.`, nextKg: load };
}

export type PRKind = 'first' | 'weight' | 'e1rm' | 'reps' | 'volume';
export interface PR { exerciseId: string; kind: PRKind; value: number; previous: number | null; reps: number; loadKg: number }

/** Epley for comparing sets, accepted up to 15 reps (records only; e1rm() stays strict at 10). */
export const strength = (load: number, reps: number) => (load > 0 && reps >= 1 && reps <= 15 ? (reps === 1 ? load : load * (1 + reps / 30)) : 0);

/**
 * Records a session sets, against every finished session before it (earlier dates, or earlier the same
 * day). Each exercise gets at most one record, the strongest kind it earned:
 * - first: the exercise was never logged before (a baseline)
 * - weight: heavier than any earlier set
 * - e1rm: a better estimated max (Epley, up to 15 reps)
 * - reps: more reps than ever at this weight or heavier
 * - volume: the best single set, weight x reps
 * Dumbbell weights count both bells; warm-ups are ignored.
 */
export function personalRecords(sessions: Session[], session: Session): PR[] {
  const end = session.finishedAt ?? '9999';
  const prior = sessions.filter((s) => s.id !== session.id && s.finishedAt && (s.date < session.date || (s.date === session.date && s.finishedAt < end)));
  return groupByExercise(working(session.sets)).flatMap(({ exerciseId, sets }) => {
    const done = sets.filter((x) => x.reps > 0);
    if (!done.length) return [];
    const before = prior.flatMap((s) => working(s.sets).filter((x) => x.exerciseId === exerciseId && x.reps > 0));
    const top = done.reduce((a, b) => (totalLoad(b) > totalLoad(a) || (totalLoad(b) === totalLoad(a) && b.reps > a.reps) ? b : a));
    const pr = (kind: PRKind, value: number, previous: number | null, x = top): PR[] => [{ exerciseId, kind, value, previous, reps: x.reps, loadKg: totalLoad(x) }];
    if (!before.length) return pr('first', totalLoad(top), null);

    const heaviest = Math.max(...before.map(totalLoad));
    if (totalLoad(top) > heaviest + 0.01) return pr('weight', totalLoad(top), heaviest);

    const bestE = Math.max(...before.map((x) => strength(totalLoad(x), x.reps)));
    const e = done.reduce((a, b) => (strength(totalLoad(b), b.reps) > strength(totalLoad(a), a.reps) ? b : a));
    if (strength(totalLoad(e), e.reps) > bestE + 0.01) return pr('e1rm', strength(totalLoad(e), e.reps), bestE || null, e);

    for (const x of done) {
      const most = Math.max(0, ...before.filter((y) => totalLoad(y) >= totalLoad(x) - 0.01).map((y) => y.reps));
      if (x.reps > most) return pr('reps', x.reps, most || null, x);
    }
    const bestV = Math.max(...before.map((x) => totalLoad(x) * x.reps));
    const v = done.reduce((a, b) => (totalLoad(b) * b.reps > totalLoad(a) * a.reps ? b : a));
    if (totalLoad(v) * v.reps > bestV + 0.01) return pr('volume', totalLoad(v) * v.reps, bestV, v);
    return [];
  });
}

/** Rest before set i: as recorded, or worked out from the time since the previous set (up to 30 min). */
export function restBefore(sets: WorkoutSet[], i: number) {
  if (sets[i].restSeconds !== null && sets[i].restSeconds !== undefined) return sets[i].restSeconds;
  if (i === 0) return null;
  const s = (Date.parse(sets[i].completedAt) - Date.parse(sets[i - 1].completedAt)) / 1000;
  return s > 0 && s <= 1800 ? Math.round(s) : null;
}

/**
 * Warm-up ramps by number of warm-up sets: share of the working weight and reps. Two sets follow
 * Ribeiro et al. (2021: 40% and 80% of the training load before 3 x 6), with fewer reps on the heavier
 * one; their review found single warm-ups work best when heavier, hence 70% for one.
 */
const RAMPS: [number, number][][] = [
  [],
  [[0.7, 5]],
  [[0.4, 6], [0.8, 4]],
  [[0.4, 8], [0.6, 5], [0.8, 3]],
  [[0.4, 8], [0.55, 5], [0.7, 3], [0.85, 1]],
  [[0.4, 8], [0.5, 5], [0.6, 4], [0.75, 2], [0.85, 1]],
];

export interface PlannedSets {
  workKg: number | null; // per dumbbell when two are used
  basis: string; // where the working weight comes from
  warmups: { kg: number | null; reps: number; share: number }[];
  working: { reps: string; rir: number; restSeconds: number }[];
}

/**
 * The sets of one planned exercise with weights: the warm-up ramp up to the working weight, then the
 * working sets. The working weight is the program's, else the one that should leave the target RIR
 * at the middle of the rep range from the latest set logged with an RIR (see loadForRir), else the
 * last weight used. `round` snaps a weight to what the equipment allows.
 */
export function planSets(p: Prescription, sessions: Session[], round: (kg: number) => number): PlannedSets {
  const past = sessions
    .filter((s) => s.finishedAt)
    .sort((a, b) => b.finishedAt!.localeCompare(a.finishedAt!))
    .flatMap((s) => [...working(s.sets)].reverse().filter((x) => x.exerciseId === p.exerciseId && x.reps > 0));
  const target = Math.round((p.minReps + p.maxReps) / 2);
  let workKg: number | null = null;
  let basis = 'No weight yet: pick one you can lift for the reps with the RIR left, then the next plan suggests from it.';
  const withRir = past.find((x) => x.rir !== null);
  const est = withRir ? loadForRir(withRir, target, p.rir) : null;
  if (p.loadKg) {
    workKg = p.loadKg;
    basis = 'Weight set in the program.';
  } else if (withRir && est !== null) {
    workKg = round(est);
    basis = `For ${target} reps at RIR ${p.rir}, from your ${withRir.loadKg} × ${withRir.reps} at RIR ${withRir.rir} (reps + RIR possible, Epley).`;
  } else if (past[0]) {
    workKg = past[0].loadKg;
    basis = 'Your last weight; log the RIR to get a weight matched to the target.';
  }
  const ramp: [number, number][] = p.warmups?.length ? p.warmups.map((w) => [w.share, w.reps]) : RAMPS[Math.min(5, p.warmupSets ?? 0)];
  return {
    workKg,
    basis,
    warmups: ramp.map(([share, reps]) => ({ share, reps, kg: workKg === null ? null : round(workKg * share) })),
    working: Array.from({ length: p.sets }, () => ({ reps: p.minReps === p.maxReps ? `${p.minReps}` : `${p.minReps}–${p.maxReps}`, rir: p.rir, restSeconds: p.restSeconds })),
  };
}

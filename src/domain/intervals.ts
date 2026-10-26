// Cardio interval timeline and the countdown schedule shared by cardio and rest timers.
import { cueWords, paceInText, spokenPace } from './track.ts';
import type { IntervalPlan, PaceRange } from './types.ts';

export type PhaseKind = 'warmup' | 'work' | 'recovery' | 'cooldown';
export interface Phase { kind: PhaseKind; round: number; seconds: number; cue: string; pace: PaceRange | null; start: number; end: number }

/** The cue a phase shows; warm-up and cool-down have a default. */
export function phaseCue(plan: IntervalPlan, kind: PhaseKind) {
  if (kind === 'warmup') return plan.warmupCue || 'Easy';
  if (kind === 'cooldown') return plan.cooldownCue || 'Ease down';
  return kind === 'work' ? plan.workCue : plan.recoveryCue;
}

/** A phase's pace window: the plan's own, or one written in its cue ("4:30 /km"). */
export function phasePace(plan: IntervalPlan, kind: PhaseKind): PaceRange | null {
  const own = { warmup: plan.warmupPace, work: plan.workPace, recovery: plan.recoveryPace, cooldown: plan.cooldownPace }[kind];
  return own ?? paceInText(phaseCue(plan, kind));
}

export function timeline(plan: IntervalPlan): Phase[] {
  const out: Phase[] = [];
  let t = 0;
  const add = (kind: PhaseKind, round: number, seconds: number) => {
    if (seconds <= 0) return;
    out.push({ kind, round, seconds, cue: phaseCue(plan, kind), pace: phasePace(plan, kind), start: t, end: t + seconds });
    t += seconds;
  };
  add('warmup', 0, plan.warmupSeconds);
  for (let r = 1; r <= plan.rounds; r++) {
    add('work', r, plan.workSeconds);
    if (r < plan.rounds) add('recovery', r, plan.recoverySeconds);
  }
  add('cooldown', 0, plan.cooldownSeconds);
  return out;
}

/** A length as the voice says it: "45 seconds", "2 minutes", "2 minutes 30". */
export function spokenTime(seconds: number) {
  const s = Math.round(seconds);
  if (s <= 90) return `${s} seconds`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m} ${m === 1 ? 'minute' : 'minutes'}${r ? ` ${r}` : ''}`;
}

/** "Target pace 7 30 per kilometre", or "Pace 7 15 to 8 15 per kilometre" for a window. */
export function spokenTarget(r: PaceRange, unit: 'km' | 'mi' = 'km') {
  const per = unit === 'mi' ? 'per mile' : 'per kilometre';
  const a = spokenPace(r.fast, unit);
  const b = spokenPace(r.slow, unit);
  if (a === b) return `Target pace ${a} ${per}`;
  // "10 to 12 minutes", not "10 minutes to 12 minutes".
  return `Pace ${a.endsWith(' minutes') && b.endsWith(' minutes') ? a.slice(0, -8) : a} to ${b} ${per}`;
}

/**
 * What the voice coach says as a phase starts: the phase, its length, the round and how many are
 * left, the cue and the pace. With no phase (index past the end), the closing line.
 */
export function announce(plan: IntervalPlan, phases: Phase[], index: number, paced = true) {
  const p = phases[index];
  if (!p) return 'Workout complete. Well done.';
  const unit = plan.paceUnit ?? 'km';
  const words = cueWords(p.cue);
  const parts: string[] = [];
  if (p.kind === 'warmup') parts.push(`Warm-up, ${spokenTime(p.seconds)}`);
  if (p.kind === 'work') {
    if (plan.rounds > 1) parts.push(p.round === plan.rounds ? `Last round, ${p.round} of ${plan.rounds}` : `Round ${p.round} of ${plan.rounds}`);
    parts.push(`Work, ${spokenTime(p.seconds)}`);
  }
  if (p.kind === 'recovery') {
    const left = plan.rounds - p.round;
    parts.push(`Recover, ${spokenTime(p.seconds)}`, `${left} ${left === 1 ? 'round' : 'rounds'} to go`);
  }
  if (p.kind === 'cooldown') parts.push(plan.rounds > 1 ? 'All rounds done' : 'Work done', `Cool-down, ${spokenTime(p.seconds)}`);
  if (words) parts.push(words);
  if (paced && p.pace) parts.push(spokenTarget(p.pace, unit));
  return `${parts.join('. ')}.`;
}

/** Roughly how far a plan goes at the middle of each phase's pace window, in km; null without paces. */
export function plannedKm(phases: Phase[]) {
  if (!phases.some((p) => p.pace)) return null;
  return phases.reduce((n, p) => n + (p.pace ? p.seconds / ((p.pace.fast + p.pace.slow) / 2) : 0), 0);
}

export const totalSeconds = (plan: IntervalPlan) => timeline(plan).reduce((n, p) => n + p.seconds, 0);

/** A running clock that survives pauses: elapsed = banked + (now − resumedAt). */
export interface Clock { banked: number; resumedAt: number | null }
export const elapsed = (c: Clock, now = Date.now()) => c.banked + (c.resumedAt === null ? 0 : (now - c.resumedAt) / 1000);
export const pause = (c: Clock, now = Date.now()): Clock => ({ banked: elapsed(c, now), resumedAt: null });
export const resume = (c: Clock, now = Date.now()): Clock => (c.resumedAt === null ? { ...c, resumedAt: now } : c);

export function position(phases: Phase[], seconds: number) {
  const index = phases.findIndex((p) => p.end > seconds);
  if (index < 0) return { index: phases.length, phase: null, remaining: 0, progress: 1 };
  const phase = phases[index];
  return { index, phase, remaining: phase.end - seconds, progress: (seconds - phase.start) / phase.seconds };
}

/** Jumps to the start of the next phase. */
export function skip(c: Clock, phases: Phase[], now = Date.now()): Clock {
  const p = position(phases, elapsed(c, now));
  const target = p.phase ? p.phase.end : elapsed(c, now);
  return { banked: target, resumedAt: c.resumedAt === null ? null : now };
}

/**
 * Which beep to play for a given whole second remaining. A countdown of N gives a short
 * tick at N…1 seconds and the long tone at 0, so "5" sounds 5-4-3-2-1-GO.
 */
export function beepFor(remaining: number, countdown: number): 'tick' | 'end' | null {
  const s = Math.ceil(remaining - 1e-6);
  if (s <= 0) return 'end';
  return countdown > 0 && s <= countdown ? 'tick' : null;
}

export const formatClock = (s: number) => {
  const v = Math.max(0, Math.ceil(s));
  const h = Math.floor(v / 3600);
  const m = Math.floor((v % 3600) / 60);
  const sec = String(v % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
};

/** Pace in min/km from a distance and minutes. */
export function pace(minutes: number, km: number | null) {
  if (!km || km <= 0 || minutes <= 0) return null;
  const p = minutes / km;
  return `${Math.floor(p)}:${String(Math.round((p % 1) * 60)).padStart(2, '0')} /km`;
}

/** Energy estimate from MET values (Compendium of Physical Activities): kcal = MET × kg × hours. */
export const METS: Record<string, number> = {
  Running: 9.8, Walking: 3.5, Cycling: 7.5, Rowing: 7, Swimming: 6, Elliptical: 5, Stairs: 8.8, HIIT: 8, Treadmill: 8, Other: 5,
};
export const cardioKcal = (activity: string, minutes: number, weightKg: number | null) =>
  weightKg ? Math.round((METS[activity] ?? 5) * weightKg * (minutes / 60)) : null;

// Cardio interval timeline and the countdown schedule shared by cardio and rest timers.
import type { IntervalPlan } from './types.ts';

export type PhaseKind = 'warmup' | 'work' | 'recovery' | 'cooldown';
export interface Phase { kind: PhaseKind; round: number; seconds: number; cue: string; start: number; end: number }

export function timeline(plan: IntervalPlan): Phase[] {
  const out: Phase[] = [];
  let t = 0;
  const add = (kind: PhaseKind, round: number, seconds: number, cue: string) => {
    if (seconds <= 0) return;
    out.push({ kind, round, seconds, cue, start: t, end: t + seconds });
    t += seconds;
  };
  add('warmup', 0, plan.warmupSeconds, 'Easy');
  for (let r = 1; r <= plan.rounds; r++) {
    add('work', r, plan.workSeconds, plan.workCue);
    if (r < plan.rounds) add('recovery', r, plan.recoverySeconds, plan.recoveryCue);
  }
  add('cooldown', 0, plan.cooldownSeconds, 'Ease down');
  return out;
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

// Per-muscle views for the Progress body: fatigue (how recently and how hard each muscle was trained)
// and strength (how its lifts' estimated 1RM moved). Pure functions over logged sets; no invented scores.
//
// Fatigue: what shows is what was done (hard sets in the last 72 h, how many at 0-1 RIR, when last
// trained) and a recovery estimate from it. Strength and power usually come back within 24-72 h after
// training; sets taken to failure slow recovery noticeably over the first 24-48 h compared with stopping
// short (Morán-Navarro et al. 2017, Eur J Appl Physiol), and more volume takes longer (eccentric volume
// studies). So: a muscle is "fresh" 24 h after light work, 48 h after 6+ hard sets or any set at 0-1 RIR,
// 72 h after 10+ hard sets. Supporting muscles count half, as in the sets-per-muscle view. An estimate.
//
// Strength: for every exercise working a muscle, the best estimated 1RM (Epley, with reps in reserve
// counted as reps) in the last 4 weeks against the 4 weeks before; the muscle's change is the average
// of its lifts weighted by their sets. Only lifts done in both periods count.
import { REGIONS, strength, totalLoad, working } from './calc.ts';
import type { Exercise, Region, Session, WorkoutSet } from './types.ts';

const HOUR = 3600000;
const DAY = 24 * HOUR;

export type Readiness = 'fatigued' | 'recovering' | 'fresh';
export interface MuscleFatigue {
  hardSets: number; // working sets in the last 72 h, supporting muscles counting half
  nearFailure: number; // of them at 0-1 RIR
  lastAt: number | null; // when it last did a working set, ms
  freshAt: number | null; // estimated time it is fresh again
  status: Readiness;
  load: number; // 0-1, for the body map: hard sets fading over 72 h
}

const at = (s: WorkoutSet, session: Session) => Date.parse(s.completedAt || session.finishedAt || `${session.date}T12:00:00`);

export function muscleFatigue(sessions: Session[], byId: Record<string, Exercise>, now = Date.now()): Record<Region, MuscleFatigue> {
  const out = Object.fromEntries(REGIONS.map((r) => [r, { hardSets: 0, nearFailure: 0, lastAt: null, freshAt: null, status: 'fresh', load: 0 }])) as Record<Region, MuscleFatigue>;
  const recent = new Map<Region, { t: number; w: number; failure: boolean }[]>();
  for (const session of sessions) {
    for (const s of working(session.sets)) {
      const e = byId[s.exerciseId];
      if (!e) continue;
      const t = at(s, session);
      if (t > now || now - t > 4 * DAY) continue;
      const add = (r: Region, w: number) => {
        const m = out[r];
        m.lastAt = Math.max(m.lastAt ?? 0, t);
        if (now - t <= 3 * DAY) {
          m.hardSets += w;
          if (s.rir !== null && s.rir <= 1) m.nearFailure += w;
        }
        recent.set(r, [...(recent.get(r) ?? []), { t, w, failure: s.rir !== null && s.rir <= 1 }]);
      };
      e.primary.forEach((r) => add(r, 1));
      e.secondary.filter((r) => !e.primary.includes(r)).forEach((r) => add(r, 0.5));
    }
  }
  for (const r of REGIONS) {
    const m = out[r];
    const sets = recent.get(r) ?? [];
    if (!sets.length || m.lastAt === null) continue;
    // The last session's work decides how long it needs: the sets within 12 h of the last one.
    const last = sets.filter((x) => m.lastAt! - x.t <= 12 * HOUR);
    const volume = last.reduce((n, x) => n + x.w, 0);
    const failure = last.some((x) => x.failure && x.w === 1);
    const need = volume >= 10 ? 72 : volume >= 6 || failure ? 48 : 24;
    m.freshAt = m.lastAt + need * HOUR;
    m.status = now >= m.freshAt ? 'fresh' : now - m.lastAt < need * HOUR * 0.5 ? 'fatigued' : 'recovering';
    // Hard sets fading linearly to nothing at 72 h; 10 recent hard sets fill the scale.
    m.load = Math.min(1, sets.reduce((n, x) => n + x.w * Math.max(0, 1 - (now - x.t) / (3 * DAY)), 0) / 10);
    m.hardSets = Math.round(m.hardSets * 10) / 10;
    m.nearFailure = Math.round(m.nearFailure * 10) / 10;
  }
  return out;
}

export interface LiftChange { exerciseId: string; before: number; after: number; change: number; sets: number }
export interface MuscleStrength { change: number | null; lifts: LiftChange[] }

/** Best estimated 1RM per exercise in the last 4 weeks against the 4 before, gathered by muscle. */
export function muscleStrength(sessions: Session[], byId: Record<string, Exercise>, now = Date.now()): Record<Region, MuscleStrength> {
  const best = (from: number, until: number) => {
    const m = new Map<string, { e1: number; sets: number }>();
    for (const session of sessions) {
      if (!session.finishedAt) continue;
      for (const s of working(session.sets)) {
        const t = at(s, session);
        if (t < from || t >= until) continue;
        const e1 = strength(totalLoad(s), s.reps + (s.rir ?? 0));
        const cur = m.get(s.exerciseId) ?? { e1: 0, sets: 0 };
        m.set(s.exerciseId, { e1: Math.max(cur.e1, e1), sets: cur.sets + 1 });
      }
    }
    return m;
  };
  const after = best(now - 28 * DAY, now + 1);
  const before = best(now - 56 * DAY, now - 28 * DAY);
  const out = {} as Record<Region, MuscleStrength>;
  for (const r of REGIONS) out[r] = { change: null, lifts: [] };
  for (const [id, a] of after) {
    const b = before.get(id);
    const e = byId[id];
    if (!e || !b || !(b.e1 > 0) || !(a.e1 > 0)) continue;
    const lift: LiftChange = { exerciseId: id, before: b.e1, after: a.e1, change: (a.e1 - b.e1) / b.e1, sets: a.sets };
    for (const r of e.primary) out[r].lifts.push(lift);
  }
  for (const r of REGIONS) {
    const lifts = out[r].lifts.sort((x, y) => y.sets - x.sets);
    const sets = lifts.reduce((n, l) => n + l.sets, 0);
    out[r].change = sets ? lifts.reduce((n, l) => n + l.change * l.sets, 0) / sets : null;
  }
  return out;
}

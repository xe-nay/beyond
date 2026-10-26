// What cardio sessions say about the body, from what the app records (time, distance, effort, activity).
// Pure functions; every figure names where it comes from.
//
// - WHO 2020 guidelines: 150–300 min a week of moderate activity, or 75–150 min vigorous, or an
//   equivalent mix (a vigorous minute counts as two moderate ones).
// - Session RPE load (Foster et al. 2001): minutes × effort 1–10. Weekly load, monotony (Foster 1998:
//   mean daily load / its standard deviation; above 2 is a warning) and the acute:chronic ratio (this
//   week against the 4 weeks before; about 0.8–1.3 is the usual range in team-sport studies, Gabbett 2016).
// - VDOT (Daniels & Gilbert 1979): oxygen cost of a pace and the share of VO2max held for that long;
//   from a hard continuous run it estimates aerobic fitness. A performance number, not a lab VO2max.
// - Riegel (1977): T2 = T1 × (D2 / D1)^1.06 for race predictions; best between similar distances.
// - Energy: MET values (Compendium of Physical Activities).
import { METS } from './intervals.ts';
import type { CardioSession } from './types.ts';

const DAY = 86400000;
const t = (date: string) => Date.parse(`${date}T12:00:00`);

/** Effort 7 or more, or HIIT, counts as vigorous; anything else as moderate. No effort logged: moderate. */
export const vigorous = (c: CardioSession) => c.activity === 'HIIT' || (c.rpe ?? 0) >= 7;

/** Minutes towards the WHO guideline in a week: moderate minutes plus vigorous minutes counted twice. */
export function guidelineMinutes(cardio: CardioSession[], from: number, until: number) {
  let moderate = 0;
  let hard = 0;
  for (const c of cardio) {
    if (!c.completed || t(c.date) < from || t(c.date) >= until) continue;
    if (vigorous(c)) hard += c.minutes;
    else moderate += c.minutes;
  }
  return { moderate, vigorous: hard, equivalent: moderate + 2 * hard };
}

/** Daniels & Gilbert: VO2 (ml/kg/min) at a speed in m/min, and the share of VO2max held for `min` minutes. */
export function vdot(km: number, minutes: number) {
  if (!(km > 0) || !(minutes > 0)) return null;
  const v = (km * 1000) / minutes;
  const vo2 = -4.6 + 0.182258 * v + 0.000104 * v * v;
  const share = 0.8 + 0.1894393 * Math.exp(-0.012778 * minutes) + 0.2989558 * Math.exp(-0.1932605 * minutes);
  const x = vo2 / share;
  return Number.isFinite(x) && x > 10 && x < 90 ? x : null;
}

/** Riegel: the time for `km` from a run of `fromKm` in `minutes`. */
export const riegel = (fromKm: number, minutes: number, km: number) => minutes * (km / fromKm) ** 1.06;

/**
 * Runs that can stand for a race effort: running, one continuous effort (no intervals), 1.5 km or more,
 * effort 7 or more. The best VDOT among them.
 */
export function fitness(cardio: CardioSession[]) {
  let best: { vdot: number; run: CardioSession } | null = null;
  for (const c of cardio) {
    if (!c.completed || c.activity !== 'Running' || !c.distanceKm || c.distanceKm < 1.5 || (c.rpe ?? 0) < 7) continue;
    if (c.plan && (c.plan.rounds > 1 || c.plan.recoverySeconds > 0)) continue;
    const v = vdot(c.distanceKm, c.minutes);
    if (v !== null && (!best || v > best.vdot)) best = { vdot: v, run: c };
  }
  if (!best) return null;
  const { distanceKm: km, minutes } = best.run;
  return { vdot: Math.round(best.vdot * 10) / 10, run: best.run, fiveK: riegel(km!, minutes, 5), tenK: riegel(km!, minutes, 10) };
}

/** Average pace in seconds per km over sessions of one activity with a distance. */
export function averagePace(cardio: CardioSession[], activity: string, from: number, until: number) {
  let min = 0;
  let km = 0;
  for (const c of cardio) {
    if (!c.completed || c.activity !== activity || !c.distanceKm || t(c.date) < from || t(c.date) >= until) continue;
    min += c.minutes;
    km += c.distanceKm;
  }
  return km >= 1 ? (min * 60) / km : null;
}

/** One day's training load: minutes × effort (5 when no effort was logged). */
export const sessionLoad = (minutes: number, rpe: number | null) => minutes * (rpe ?? 5);

export interface LoadDay { date: string; load: number }

/**
 * This week's load against the four weeks before, and how evenly it was spread (monotony). `days` holds
 * every session's load, cardio and lifting together.
 */
export function loadReport(days: LoadDay[], now: Date) {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  const sum = (from: number, until: number) => days.filter((d) => t(d.date) >= from && t(d.date) < until).reduce((n, d) => n + d.load, 0);
  const acute = sum(end - 7 * DAY, end);
  const chronic = [1, 2, 3, 4].map((w) => sum(end - (w + 1) * 7 * DAY, end - w * 7 * DAY));
  const weeksWithData = chronic.filter((x) => x > 0).length;
  const mean = chronic.reduce((a, b) => a + b, 0) / 4;
  const daily = Array.from({ length: 7 }, (_, i) => sum(end - (i + 1) * DAY, end - i * DAY));
  const avg = daily.reduce((a, b) => a + b, 0) / 7;
  const sd = Math.sqrt(daily.reduce((n, x) => n + (x - avg) ** 2, 0) / 7);
  return {
    acute,
    chronic: Math.round(mean),
    ratio: weeksWithData >= 3 && mean > 0 ? Math.round((acute / mean) * 100) / 100 : null,
    monotony: sd > 0 ? Math.round((avg / sd) * 10) / 10 : null,
    strain: sd > 0 ? Math.round(acute * (avg / sd)) : null,
  };
}

export const kcal = (c: CardioSession, weightKg: number | null) => (weightKg ? (METS[c.activity] ?? 5) * weightKg * (c.minutes / 60) : 0);

export interface Insight { tone: 'good' | 'watch' | 'info'; title: string; detail: string }

/** What the numbers add up to, in plain words. */
export function insights(o: {
  week: ReturnType<typeof guidelineMinutes>;
  load: ReturnType<typeof loadReport>;
  pace: { now: number | null; before: number | null };
  fit: ReturnType<typeof fitness>;
  activeWeeks: number;
}): Insight[] {
  const out: Insight[] = [];
  const e = Math.round(o.week.equivalent);
  if (e >= 300) out.push({ tone: 'good', title: 'Above the upper WHO target', detail: `${e} moderate-equivalent minutes this week. The WHO range is 150–300; more brings extra benefit when recovery keeps up.` });
  else if (e >= 150) out.push({ tone: 'good', title: 'WHO weekly target met', detail: `${e} of 150 moderate-equivalent minutes this week (vigorous minutes count twice).` });
  else out.push({ tone: 'info', title: `${150 - e} minutes to the WHO weekly target`, detail: `${e} of 150 moderate-equivalent minutes so far this week. A vigorous minute (effort 7+) counts as two.` });

  if (o.pace.now && o.pace.before) {
    const diff = Math.round(o.pace.before - o.pace.now);
    const pct = Math.abs(Math.round(((o.pace.before - o.pace.now) / o.pace.before) * 100));
    if (Math.abs(diff) >= 5) {
      out.push(diff > 0
        ? { tone: 'good', title: `Running ${diff} s/km faster`, detail: `Average pace over the last 4 weeks against the 4 before (${pct}%). At a similar effort, a faster pace means better aerobic fitness. Intervals with walking make the average slower.` }
        : { tone: 'watch', title: `Running ${-diff} s/km slower`, detail: `Average pace over the last 4 weeks against the 4 before. Easier sessions, heat, hills or tiredness also slow it.` });
    }
  }

  if (o.load.ratio !== null) {
    const r = o.load.ratio;
    if (r > 1.5) out.push({ tone: 'watch', title: 'Big jump in training load', detail: `This week is ${r}× your 4-week average (lifting and cardio). Sharp spikes above about 1.3–1.5 go with more injuries in sports studies; build up gradually.` });
    else if (r > 1.3) out.push({ tone: 'watch', title: 'Load rising fast', detail: `This week is ${r}× your 4-week average. About 0.8–1.3 is the usual safe range.` });
    else if (r < 0.8) out.push({ tone: 'info', title: 'Lighter week', detail: `${r}× your 4-week average: fine as a recovery week, but fitness fades if it lasts.` });
    else out.push({ tone: 'good', title: 'Load in a steady range', detail: `This week is ${r}× your 4-week average, inside the usual 0.8–1.3.` });
  }
  if (o.load.monotony !== null && o.load.monotony > 2) out.push({ tone: 'watch', title: 'Every day feels the same', detail: `Monotony ${o.load.monotony} (above 2 is high): mix easier and harder days to recover better.` });

  if (o.fit) out.push({ tone: 'info', title: `Aerobic fitness about VDOT ${o.fit.vdot}`, detail: `From your best hard continuous run. VDOT is a performance score close to VO2max (ml/kg/min), not a lab test.` });
  else out.push({ tone: 'info', title: 'No fitness estimate yet', detail: 'Run 1.5 km or more in one go at effort 7 or harder, and log the distance: the app estimates VDOT and race times from it.' });

  out.push(o.activeWeeks >= 6
    ? { tone: 'good', title: 'Consistent', detail: `Cardio in ${o.activeWeeks} of the last 8 weeks. Regular sessions matter more than any single one.` }
    : { tone: 'info', title: `Cardio in ${o.activeWeeks} of the last 8 weeks`, detail: 'Fitness gains come from weeks in a row; two or three sessions a week is a good base.' });
  return out;
}

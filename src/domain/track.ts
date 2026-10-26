// Distance and pace from GPS fixes. Pure functions; the phone side lives in src/gps.ts.

import type { PaceRange } from './types.ts';

export interface Fix { lat: number; lon: number; t: number; accuracy: number | null } // t in ms
export interface Sample { t: number; m: number } // cumulative metres at time t

/** Great-circle distance in metres. */
export function haversine(a: Fix, b: Fix) {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Fastest believable speed per activity, m/s; anything quicker is a GPS jump. */
const MAX_SPEED: Record<string, number> = { Running: 9, Walking: 4, Cycling: 25 };
export const tracksDistance = (activity: string) => activity in MAX_SPEED;

/**
 * Metres to add for a new fix, or null to drop it. Imprecise fixes are dropped; jitter under the
 * fix's own accuracy is ignored without moving the anchor, so standing still adds nothing.
 */
export function step(prev: Fix | null, next: Fix, activity: string): { add: number; anchor: Fix } | null {
  if (next.accuracy !== null && next.accuracy > 30) return null;
  if (!prev) return { add: 0, anchor: next };
  const d = haversine(prev, next);
  const dt = (next.t - prev.t) / 1000;
  if (dt <= 0) return null;
  if (d / dt > (MAX_SPEED[activity] ?? 9)) return null;
  if (d < Math.max(3, (next.accuracy ?? 5) * 0.5)) return { add: 0, anchor: prev };
  return { add: d, anchor: next };
}

/** Seconds per km over the last `window` seconds, once there is enough movement to trust it. */
export function rollingPace(samples: Sample[], now: number, window = 30) {
  const recent = samples.filter((s) => s.t >= now - window * 1000);
  if (recent.length < 2) return null;
  const a = recent[0];
  const b = recent[recent.length - 1];
  const dm = b.m - a.m;
  const dt = (b.t - a.t) / 1000;
  if (dm < 40 || dt < 10) return null;
  return dt / (dm / 1000);
}

const MILE = 1.609344;
const TIME = '(\\d{1,2}):(\\d{2})';
const RANGE = `${TIME}(?:\\s*(?:-|–|—|to)\\s*${TIME})?`;
const UNIT = '(?:\\s*min)?\\s*(?:/|per)\\s*(km|kilomet(?:er|re)s?|mi|miles?)\\b';
/** A pace inside free text, with its unit: "Easy walk 10:00–12:00 min/km", "4:30 /km", "7:15/mi". */
const IN_TEXT = new RegExp(`${RANGE}${UNIT}`, 'i');
/** A whole value: "7:30", "7:30 /km", "7:15-8:15 /km", "8:00 min/mi". No unit means per km. */
const WHOLE = new RegExp(`^\\s*${RANGE}(?:${UNIT})?\\s*$`, 'i');

function toRange(m: RegExpMatchArray): PaceRange {
  const a = +m[1] * 60 + +m[2];
  const b = m[3] ? +m[3] * 60 + +m[4] : a;
  const per = /^mi/i.test(m[5] ?? '') ? 1 / MILE : 1;
  const [fast, slow] = [Math.min(a, b) * per, Math.max(a, b) * per].map((x) => Math.round(x * 10) / 10);
  return { fast, slow };
}

const sane = (r: PaceRange) => r.fast >= 60 && r.slow <= 3600;

/**
 * A pace window in seconds per km from what a plan or import gives: a number (s/km), text such as
 * "7:15-8:15 /km", or { fast, slow } / { from, to }. Null when there is none; undefined when it is
 * there but cannot be read, so an import can say so.
 */
export function readPace(v: unknown): PaceRange | null | undefined {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) && v >= 60 && v <= 3600 ? { fast: v, slow: v } : undefined;
  if (typeof v === 'string') {
    const m = v.match(WHOLE);
    const r = m ? toRange(m) : undefined;
    return r && sane(r) ? r : undefined;
  }
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const a = readPace(o.fast ?? o.from ?? o.min);
    const b = readPace(o.slow ?? o.to ?? o.max ?? o.fast ?? o.from ?? o.min);
    if (!a || !b) return undefined;
    return { fast: Math.min(a.fast, b.fast), slow: Math.max(a.slow, b.slow) };
  }
  return undefined;
}

/** A pace written inside a cue, or null. */
export function paceInText(text: string | undefined): PaceRange | null {
  const m = text?.match(IN_TEXT);
  const r = m ? toRange(m) : null;
  return r && sane(r) ? r : null;
}

/** The cue without the pace in it: "Easy walk 10:00–12:00 min/km" → "Easy walk". */
export const cueWords = (text: string | undefined) =>
  (text ?? '').replace(IN_TEXT, '').replace(/[\s,;:·(–-]+$/, '').replace(/^[\s,;:·)–-]+/, '').trim();

/** Target seconds per km from a cue such as "4:30 /km" or "7:15/mi" (the slow end of a range); null when there is none. */
export const targetPace = (cue: string | undefined) => paceInText(cue)?.slow ?? null;

/** On pace means at the target or faster, with 3% of slack. */
export const onPace = (pace: number, target: number) => pace <= target * 1.03;

/**
 * Where a live pace sits against a window. A little slack each way, so GPS wobble does not nag:
 * slower than the slow end by 4%, or faster than the fast end by 6%.
 */
export function paceVerdict(pace: number, r: PaceRange): 'slow' | 'fast' | 'on' {
  if (pace > r.slow * 1.04) return 'slow';
  if (pace < r.fast * 0.94) return 'fast';
  return 'on';
}

const inUnit = (secPerKm: number, unit: 'km' | 'mi') => (unit === 'mi' ? secPerKm * MILE : secPerKm);

/** "7:15–8:15 /km", or "7:30 /km" for one target. */
export function formatPaceRange(r: PaceRange, unit: 'km' | 'mi' = 'km') {
  const a = formatPace(inUnit(r.fast, unit));
  const b = formatPace(inUnit(r.slow, unit));
  return `${a === b ? a : `${a}–${b}`} /${unit}`;
}

/** A pace as the voice should say it: "7 30", "8 minutes", "7 oh 5". */
export function spokenPace(secPerKm: number, unit: 'km' | 'mi' = 'km') {
  const v = Math.round(inUnit(secPerKm, unit));
  const m = Math.floor(v / 60);
  const s = v % 60;
  return s === 0 ? `${m} minutes` : `${m} ${s < 10 ? `oh ${s}` : s}`;
}

export function formatPace(secPerKm: number | null) {
  if (!secPerKm || !Number.isFinite(secPerKm) || secPerKm >= 3600) return '–:––';
  const s = Math.round(secPerKm);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

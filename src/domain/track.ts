// Distance and pace from GPS fixes. Pure functions; the phone side lives in src/gps.ts.

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

/** Target seconds per km from a cue such as "4:30 /km" or "7:15/mi"; null when the cue is not a pace. */
export function targetPace(cue: string | undefined) {
  const m = cue?.match(/(\d{1,2}):(\d{2})\s*\/\s*(km|mi)\b/i);
  if (!m) return null;
  const s = +m[1] * 60 + +m[2];
  return m[3].toLowerCase() === 'mi' ? s / 1.609344 : s;
}

/** On pace means at the target or faster, with 3% of slack. */
export const onPace = (pace: number, target: number) => pace <= target * 1.03;

export function formatPace(secPerKm: number | null) {
  if (!secPerKm || !Number.isFinite(secPerKm) || secPerKm >= 3600) return '–:––';
  const s = Math.round(secPerKm);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

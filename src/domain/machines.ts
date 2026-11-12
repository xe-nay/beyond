// Cardio machines and what is set on each, per phase of a session: a treadmill's speed and incline, a
// StepMill's level and steps a minute, a rower's damper, stroke rate and split... From the machines'
// own consoles and makers' specifications:
// - Treadmills: commercial ones run about 0.8-25 km/h and 0 to 15% incline (some -3% decline, incline
//   trainers to 40%): Precor 700 series and TRM 885, Cybex 790T, True 650 specifications.
// - StepMill (revolving staircase): levels 1-20 from about 24 to 162 steps a minute, roughly 7 more
//   steps per level (StairMaster SM3 brochure; Life Time StepMill workout table). Some newer consoles go
//   to 25 levels. A pedal stair stepper has its own resistance scale: levels do not carry over.
// - Elliptical: resistance levels (10 to 40 depending on the model), a ramp/incline (0-30% on some) and
//   strides a minute (100-150 a typical working pace: Precor manual).
// - Indoor bikes: a resistance level or knob with no common scale, cadence (about 80-110 rpm seated
//   flat, 60-80 climbing, 90-120 sprinting) and watts on bikes that measure them.
// - Air bike (Assault AirBike): air resistance rises with effort, no levels; it shows RPM and watts.
// - Rower and SkiErg (Concept2): a damper 1-10 (Concept2 suggests 3-5 on the rower, 3 or lower to start
//   on the SkiErg), stroke rate, split per 500 m and watts.
// Indoor machines are timed, not measured by GPS: the phone is not moving.
import { tracksDistance } from './track.ts';
import type { CardioRange, IntervalPlan, MachineSettings } from './types.ts';

export type SettingKey = keyof MachineSettings;
export type MachineId = 'treadmill' | 'stepmill' | 'stepper' | 'elliptical' | 'bike-indoor' | 'bike-outdoor' | 'air-bike' | 'rower' | 'ski-erg';

export interface Machine {
  id: MachineId;
  name: string;
  activities: string[]; // the activities it can be; the first is the default
  indoor: boolean;
  settings: SettingKey[];
}

export const MACHINES: Machine[] = [
  { id: 'treadmill', name: 'Treadmill', activities: ['Running', 'Walking'], indoor: true, settings: ['speedKmh', 'inclinePct'] },
  { id: 'stepmill', name: 'StepMill (revolving stairs)', activities: ['Stairs'], indoor: true, settings: ['level', 'stepsPerMin'] },
  { id: 'stepper', name: 'Stair stepper (pedals)', activities: ['Stairs'], indoor: true, settings: ['level', 'stepsPerMin'] },
  { id: 'elliptical', name: 'Elliptical', activities: ['Elliptical'], indoor: true, settings: ['level', 'inclinePct', 'strideRate'] },
  { id: 'bike-indoor', name: 'Indoor bike', activities: ['Cycling'], indoor: true, settings: ['level', 'cadenceRpm', 'powerW'] },
  { id: 'bike-outdoor', name: 'Outdoor bike', activities: ['Cycling'], indoor: false, settings: ['cadenceRpm', 'powerW'] },
  { id: 'air-bike', name: 'Air bike', activities: ['Cycling', 'HIIT'], indoor: true, settings: ['cadenceRpm', 'powerW'] },
  { id: 'rower', name: 'Rower', activities: ['Rowing'], indoor: true, settings: ['damper', 'strokeRate', 'split500', 'powerW'] },
  { id: 'ski-erg', name: 'SkiErg', activities: ['Rowing'], indoor: true, settings: ['damper', 'strokeRate', 'split500', 'powerW'] },
];

/** Everyday names for the machines, as an AI or a person might write them. */
const WORDS: Record<string, MachineId> = {
  treadmill: 'treadmill', 'running-machine': 'treadmill',
  stepmill: 'stepmill', 'step-mill': 'stepmill', stairmaster: 'stepmill', 'stair-master': 'stepmill', 'stair-climber': 'stepmill', 'stair-mill': 'stepmill', stairmill: 'stepmill',
  stepper: 'stepper', 'stair-stepper': 'stepper', 'step-machine': 'stepper',
  elliptical: 'elliptical', 'cross-trainer': 'elliptical', crosstrainer: 'elliptical',
  'bike-indoor': 'bike-indoor', 'indoor-bike': 'bike-indoor', 'spin-bike': 'bike-indoor', spin: 'bike-indoor', 'stationary-bike': 'bike-indoor', 'exercise-bike': 'bike-indoor', 'upright-bike': 'bike-indoor', 'recumbent-bike': 'bike-indoor', 'indoor-cycling': 'bike-indoor',
  'bike-outdoor': 'bike-outdoor', 'outdoor-bike': 'bike-outdoor', 'road-bike': 'bike-outdoor', bike: 'bike-outdoor', bicycle: 'bike-outdoor',
  'air-bike': 'air-bike', airbike: 'air-bike', 'assault-bike': 'air-bike', 'fan-bike': 'air-bike', 'echo-bike': 'air-bike',
  rower: 'rower', 'rowing-machine': 'rower', erg: 'rower', concept2: 'rower', 'concept2-rower': 'rower',
  'ski-erg': 'ski-erg', skierg: 'ski-erg',
};

export const machineById = (id: string | undefined) => MACHINES.find((m) => m.id === id);
export function findMachine(name: unknown): Machine | undefined {
  const slug = String(name ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return machineById(WORDS[slug] ?? slug);
}

interface Setting { label: string; unit: string; min: number; max: number; step: number; spoken: (r: string) => string; word?: string }
export const SETTINGS: Record<SettingKey, Setting> = {
  speedKmh: { label: 'Speed', unit: 'km/h', min: 0.5, max: 30, step: 0.1, spoken: (r) => `Speed ${r} kilometres an hour`, word: 'Speed' },
  inclinePct: { label: 'Incline', unit: '%', min: -6, max: 40, step: 0.5, spoken: (r) => `Incline ${r} percent`, word: 'Incline' },
  level: { label: 'Level', unit: '', min: 1, max: 40, step: 1, spoken: (r) => `Level ${r}`, word: 'Level' },
  stepsPerMin: { label: 'Steps', unit: 'steps/min', min: 10, max: 200, step: 1, spoken: (r) => `${r} steps a minute` },
  strideRate: { label: 'Strides', unit: 'strides/min', min: 20, max: 300, step: 1, spoken: (r) => `${r} strides a minute` },
  cadenceRpm: { label: 'Cadence', unit: 'rpm', min: 20, max: 200, step: 1, spoken: (r) => `Cadence ${r}`, word: 'Cadence' },
  powerW: { label: 'Power', unit: 'W', min: 10, max: 2500, step: 1, spoken: (r) => `${r} watts` },
  damper: { label: 'Damper', unit: '', min: 1, max: 10, step: 1, spoken: (r) => `Damper ${r}`, word: 'Damper' },
  strokeRate: { label: 'Stroke rate', unit: 'spm', min: 10, max: 60, step: 1, spoken: (r) => `Stroke rate ${r}`, word: 'Stroke rate' },
  split500: { label: 'Split', unit: '/500 m', min: 60, max: 300, step: 1, spoken: (r) => `Split ${r} per 500`, word: 'Split' },
};

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const num = (k: SettingKey, v: number) => (k === 'split500' ? mmss(v) : String(Math.round(v * 10) / 10));
const rangeText = (k: SettingKey, r: CardioRange, sep = '–') => (r.lo === r.hi ? num(k, r.lo) : `${num(k, r.lo)}${sep}${num(k, r.hi)}`);

/** One setting's value: 8, "80-90", "2:05", "2:00-2:10" or { "min": 80, "max": 90 }. */
function readValue(k: SettingKey, raw: unknown): CardioRange | string {
  const one = (x: unknown): number => {
    if (typeof x === 'number') return x;
    const t = String(x).trim();
    const m = /^(\d+):(\d{1,2})$/.exec(t);
    if (m) return +m[1] * 60 + +m[2];
    return t === '' ? NaN : Number(t.replace(',', '.'));
  };
  let lo: number;
  let hi: number;
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    lo = one((raw as any).min ?? (raw as any).lo);
    hi = one((raw as any).max ?? (raw as any).hi ?? (raw as any).min);
  } else if (typeof raw === 'string' && /\d\s*[-–]\s*\d/.test(raw) && !/^\s*-/.test(raw)) {
    const [a, b] = raw.split(/\s*[-–]\s*/);
    lo = one(a);
    hi = one(b);
  } else {
    lo = hi = one(raw);
  }
  const s = SETTINGS[k];
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return `${k} ${JSON.stringify(raw)} is not a number or a range like "80-90".`;
  if (lo > hi) [lo, hi] = [hi, lo];
  if (lo < s.min || hi > s.max) return `${k} must be from ${num(k, s.min)} to ${num(k, s.max)}${s.unit ? ` ${s.unit}` : ''}.`;
  return { lo, hi };
}

/** A phase's settings for a machine ({ "speedKmh": 10, "inclinePct": 2 }), or a sentence saying what is wrong. */
export function readSettings(machine: Machine, raw: unknown, where: string): MachineSettings | string {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== 'object' || Array.isArray(raw)) return `${where} must be an object such as { "level": 8 }.`;
  const out: MachineSettings = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    // Miles an hour are accepted and kept in km/h.
    const k = (key === 'speedMph' ? 'speedKmh' : key) as SettingKey;
    if (!SETTINGS[k]) return `${where}: "${key}" is not a setting. ${machine.name} takes ${machine.settings.join(', ')}.`;
    if (!machine.settings.includes(k)) return `${where}: ${machine.name} has no ${k}. It takes ${machine.settings.join(', ')}.`;
    const mph = key === 'speedMph';
    const v = readValue(k, mph && typeof value === 'number' ? value * 1.609344 : value);
    if (typeof v === 'string') return `${where}: ${v}`;
    out[k] = mph && typeof value !== 'number' ? { lo: v.lo * 1.609344, hi: v.hi * 1.609344 } : v;
  }
  return out;
}

/** The settings as shown on screen: "10 km/h · 2% incline", "Level 8 · 66–73 steps/min". */
export function settingsText(s: MachineSettings | undefined | null): string {
  if (!s) return '';
  return (Object.keys(SETTINGS) as SettingKey[]).filter((k) => s[k]).map((k) => {
    const r = rangeText(k, s[k]!);
    if (k === 'level') return `Level ${r}`;
    if (k === 'damper') return `Damper ${r}`;
    if (k === 'inclinePct') return `${r}% incline`;
    return `${r} ${SETTINGS[k].unit}`;
  }).join(' · ');
}

/** The settings as the voice says them: "Speed 10 kilometres an hour. Incline 2 percent." */
export function spokenSettings(s: MachineSettings | undefined | null): string {
  if (!s) return '';
  return (Object.keys(SETTINGS) as SettingKey[]).filter((k) => s[k])
    .map((k) => SETTINGS[k].spoken(rangeText(k, s[k]!, ' to ').replace(/(\d+):(\d{2})/g, '$1 $2'))).join('. ');
}

/**
 * What the voice says moving from one phase's settings to the next: every setting at first, then only
 * what changes and which way ("Incline up to 12 percent. Speed down to 5 kilometres an hour"). Unchanged
 * settings are left out; nothing to say gives "".
 */
export function spokenChange(prev: MachineSettings | undefined | null, cur: MachineSettings | undefined | null): string {
  if (!cur) return '';
  const say = (k: SettingKey, r: CardioRange) => rangeText(k, r, ' to ').replace(/(\d+):(\d{2})/g, '$1 $2');
  const mid = (r: CardioRange) => (r.lo + r.hi) / 2;
  return (Object.keys(SETTINGS) as SettingKey[]).filter((k) => cur[k]).flatMap((k) => {
    const a = prev?.[k];
    const b = cur[k]!;
    if (a && a.lo === b.lo && a.hi === b.hi) return [];
    const full = SETTINGS[k].spoken(say(k, b));
    if (!a || mid(a) === mid(b)) return [full];
    const dir = mid(b) > mid(a) ? 'up' : 'down';
    // "Incline 12 percent" becomes "Incline up to 12 percent"; "150 watts" becomes "Up to 150 watts".
    const name = SETTINGS[k].word;
    return [name ? full.replace(`${name} `, `${name} ${dir} to `) : `${dir === 'up' ? 'Up' : 'Down'} to ${full}`];
  }).join('. ');
}

/** In the cardio editor: where a newly turned-on setting starts, and how far one tap moves it. */
export const EDIT: Record<SettingKey, { start: number; step: number }> = {
  speedKmh: { start: 9, step: 0.5 }, inclinePct: { start: 1, step: 0.5 }, level: { start: 8, step: 1 },
  stepsPerMin: { start: 66, step: 5 }, strideRate: { start: 130, step: 5 }, cadenceRpm: { start: 85, step: 5 },
  powerW: { start: 150, step: 10 }, damper: { start: 4, step: 1 }, strokeRate: { start: 22, step: 1 }, split500: { start: 125, step: 5 },
};
/** One setting's value as the editor shows it ("2:05" for a split, "5.5" for a speed). */
export const settingValueText = (k: SettingKey, v: number) => num(k, v);
/**
 * Distance on a treadmill from the speed set in each phase, over the time actually done (the middle of a
 * range); null when no phase has a speed. Shown at the end to adjust against the console.
 */
export function machineKm(phases: { start: number; end: number; settings?: MachineSettings }[], seconds: number): number | null {
  let km = 0;
  let any = false;
  for (const p of phases) {
    const v = p.settings?.speedKmh;
    if (!v) continue;
    any = true;
    km += (Math.max(0, Math.min(seconds, p.end) - p.start) * ((v.lo + v.hi) / 2)) / 3600;
  }
  return any ? km : null;
}

/** The machines a session of this activity can be done on. */
export const machinesFor = (activity: string) => MACHINES.filter((m) => m.activities.includes(activity));

/** Whether a session is measured by GPS: outdoor running, walking and cycling, never on a machine indoors. */
export const indoorPlan = (plan: Pick<IntervalPlan, 'machine'> | null | undefined) => !!machineById(plan?.machine)?.indoor;
export const usesGps = (plan: Pick<IntervalPlan, 'machine' | 'activity'>) => tracksDistance(plan.activity) && !indoorPlan(plan);

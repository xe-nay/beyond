// Micronutrients tracked beyond the macros. Amounts are kept in each nutrient's own unit (mg, µg or g).
// Daily values are the US FDA reference values for adults (2016 label rule); cholesterol, sodium and
// caffeine are limits rather than goals. Creatine has no reference value; 5 g is a common daily dose.
import type { Nutrients } from './types.ts';

export type MicroUnit = 'mg' | 'µg' | 'g';
export interface MicroDef {
  key: string;
  label: string;
  unit: MicroUnit;
  dv: number | null;
  limit?: boolean; // a ceiling to stay under, not a goal to reach
  off: string | null; // Open Food Facts nutriment name, stored in grams
  usda: number[]; // USDA FoodData Central nutrient ids, summed
  group: 'Minerals' | 'Vitamins' | 'Other';
}

export const MICROS: MicroDef[] = [
  { key: 'sodium', label: 'Sodium', unit: 'mg', dv: 2300, limit: true, off: 'sodium', usda: [1093], group: 'Minerals' },
  { key: 'potassium', label: 'Potassium', unit: 'mg', dv: 4700, off: 'potassium', usda: [1092], group: 'Minerals' },
  { key: 'calcium', label: 'Calcium', unit: 'mg', dv: 1300, off: 'calcium', usda: [1087], group: 'Minerals' },
  { key: 'magnesium', label: 'Magnesium', unit: 'mg', dv: 420, off: 'magnesium', usda: [1090], group: 'Minerals' },
  { key: 'iron', label: 'Iron', unit: 'mg', dv: 18, off: 'iron', usda: [1089], group: 'Minerals' },
  { key: 'zinc', label: 'Zinc', unit: 'mg', dv: 11, off: 'zinc', usda: [1095], group: 'Minerals' },
  { key: 'phosphorus', label: 'Phosphorus', unit: 'mg', dv: 1250, off: 'phosphorus', usda: [1091], group: 'Minerals' },
  { key: 'selenium', label: 'Selenium', unit: 'µg', dv: 55, off: 'selenium', usda: [1103], group: 'Minerals' },
  { key: 'iodine', label: 'Iodine', unit: 'µg', dv: 150, off: 'iodine', usda: [], group: 'Minerals' },
  { key: 'vitaminA', label: 'Vitamin A', unit: 'µg', dv: 900, off: 'vitamin-a', usda: [1106], group: 'Vitamins' },
  { key: 'vitaminC', label: 'Vitamin C', unit: 'mg', dv: 90, off: 'vitamin-c', usda: [1162], group: 'Vitamins' },
  { key: 'vitaminD', label: 'Vitamin D', unit: 'µg', dv: 20, off: 'vitamin-d', usda: [1114], group: 'Vitamins' },
  { key: 'vitaminE', label: 'Vitamin E', unit: 'mg', dv: 15, off: 'vitamin-e', usda: [1109], group: 'Vitamins' },
  { key: 'vitaminK', label: 'Vitamin K', unit: 'µg', dv: 120, off: 'vitamin-k', usda: [1185], group: 'Vitamins' },
  { key: 'b1', label: 'Vitamin B1', unit: 'mg', dv: 1.2, off: 'vitamin-b1', usda: [1165], group: 'Vitamins' },
  { key: 'b2', label: 'Vitamin B2', unit: 'mg', dv: 1.3, off: 'vitamin-b2', usda: [1166], group: 'Vitamins' },
  { key: 'b3', label: 'Vitamin B3', unit: 'mg', dv: 16, off: 'vitamin-pp', usda: [1167], group: 'Vitamins' },
  { key: 'b6', label: 'Vitamin B6', unit: 'mg', dv: 1.7, off: 'vitamin-b6', usda: [1175], group: 'Vitamins' },
  { key: 'folate', label: 'Folate', unit: 'µg', dv: 400, off: 'vitamin-b9', usda: [1190], group: 'Vitamins' },
  { key: 'b12', label: 'Vitamin B12', unit: 'µg', dv: 2.4, off: 'vitamin-b12', usda: [1178], group: 'Vitamins' },
  { key: 'cholesterol', label: 'Cholesterol', unit: 'mg', dv: 300, limit: true, off: 'cholesterol', usda: [1253], group: 'Other' },
  { key: 'omega3', label: 'Omega-3', unit: 'g', dv: 1.6, off: 'omega-3-fat', usda: [1404, 1278, 1272], group: 'Other' },
  { key: 'caffeine', label: 'Caffeine', unit: 'mg', dv: 400, limit: true, off: 'caffeine', usda: [1057], group: 'Other' },
  { key: 'creatine', label: 'Creatine', unit: 'g', dv: 5, off: null, usda: [], group: 'Other' },
];
export const MICRO = Object.fromEntries(MICROS.map((m) => [m.key, m])) as Record<string, MicroDef>;

/** Grams (as Open Food Facts stores them) to a nutrient's own unit. */
export const fromGrams = (g: number, unit: MicroUnit) => (unit === 'mg' ? g * 1e3 : unit === 'µg' ? g * 1e6 : g);
const round = (v: number) => (v >= 100 ? Math.round(v) : v >= 1 ? Math.round(v * 10) / 10 : Math.round(v * 1000) / 1000);

/** Micronutrients per 100 g from an Open Food Facts "nutriments" object. */
export function microsFromOff(n: Record<string, unknown>) {
  const out: Record<string, number> = {};
  for (const m of MICROS) {
    if (!m.off) continue;
    const v = n[`${m.off}_100g`];
    const g = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? +v : NaN;
    if (Number.isFinite(g) && g > 0) out[m.key] = round(fromGrams(g, m.unit));
  }
  return Object.keys(out).length ? out : undefined;
}

export function scaleMicros(micro: Nutrients['micro'], factor: number) {
  if (!micro) return undefined;
  return Object.fromEntries(Object.entries(micro).map(([k, v]) => [k, round(v * factor)]));
}

export function addMicros(a: Nutrients['micro'], b: Nutrients['micro']) {
  if (!a && !b) return undefined;
  const out: Record<string, number> = { ...a };
  for (const [k, v] of Object.entries(b ?? {})) out[k] = round((out[k] ?? 0) + v);
  return out;
}

export const formatMicro = (v: number, unit: MicroUnit) => `${round(v)} ${unit}`;

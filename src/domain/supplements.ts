// Daily supplements: what a dose holds, how it reads, and when to remind. Pure functions.
import type { DoseUnit, Intake, Micro, Nutrients, Supplement } from './types.ts';

/** Label values worth showing for supplements, as Open Food Facts names them. */
const MICROS: [key: string, label: string, unit: string][] = [
  ['vitamin-a', 'Vitamin A', 'µg'], ['vitamin-d', 'Vitamin D', 'µg'], ['vitamin-e', 'Vitamin E', 'mg'], ['vitamin-k', 'Vitamin K', 'µg'],
  ['vitamin-c', 'Vitamin C', 'mg'], ['vitamin-b1', 'Vitamin B1', 'mg'], ['vitamin-b2', 'Vitamin B2', 'mg'], ['vitamin-pp', 'Vitamin B3', 'mg'],
  ['pantothenic-acid', 'Vitamin B5', 'mg'], ['vitamin-b6', 'Vitamin B6', 'mg'], ['biotin', 'Biotin', 'µg'], ['vitamin-b9', 'Folate', 'µg'],
  ['vitamin-b12', 'Vitamin B12', 'µg'], ['calcium', 'Calcium', 'mg'], ['magnesium', 'Magnesium', 'mg'], ['zinc', 'Zinc', 'mg'],
  ['iron', 'Iron', 'mg'], ['potassium', 'Potassium', 'mg'], ['selenium', 'Selenium', 'µg'], ['iodine', 'Iodine', 'µg'],
  ['omega-3-fat', 'Omega-3', 'g'], ['caffeine', 'Caffeine', 'mg'],
];

export const UNITS: DoseUnit[] = ['g', 'mg', 'ml', 'capsule', 'tablet', 'scoop', 'drop'];
const COUNTED: DoseUnit[] = ['capsule', 'tablet', 'scoop', 'drop'];

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(+v) ? +v : null);

/** What the label tells us about a scanned supplement. Unlike food, it may have no energy value at all. */
export function supplementFromOff(p: any): Pick<Supplement, 'name' | 'brand' | 'image' | 'barcode' | 'per100' | 'servingG' | 'micros'> & { servingLabel: string | null } | null {
  const name = (p?.product_name || p?.product_name_en || p?.generic_name || '').trim();
  if (!name) return null;
  const n = p.nutriments ?? {};
  const kcal = num(n['energy-kcal_100g']) ?? (num(n['energy_100g']) !== null ? num(n['energy_100g'])! / 4.184 : null);
  const per100 = kcal === null && num(n.proteins_100g) === null ? null : {
    kcal: Math.round(kcal ?? 0), protein: num(n.proteins_100g) ?? 0, carbs: num(n.carbohydrates_100g) ?? 0, fat: num(n.fat_100g) ?? 0,
  };
  const micros: Micro[] = MICROS.flatMap(([key, label, unit]) => {
    const per100 = num(n[`${key}_100g`]);
    const perServing = num(n[`${key}_serving`]);
    const shown = typeof n[`${key}_unit`] === 'string' && ['g', 'mg', 'µg'].includes(n[`${key}_unit`]) ? n[`${key}_unit`] : unit;
    return per100 !== null || perServing !== null ? [{ key, label, unit: shown, per100, perServing }] : [];
  });
  const brand = Array.isArray(p.brands) ? p.brands[0] : (p.brands ?? '').split(',')[0]?.trim() || null;
  return {
    name, brand, image: p.image_front_url ?? p.image_front_small_url ?? null, barcode: p.code ? String(p.code) : null,
    per100, servingG: num(p.serving_quantity), micros, servingLabel: p.serving_size ?? null,
  };
}

/** Grams in one daily dose, when it can be known (1 ml counted as 1 g). */
export function doseGrams(x: Pick<Supplement, 'dose' | 'unit' | 'servingG'>) {
  if (x.unit === 'g' || x.unit === 'ml') return x.dose;
  if (x.unit === 'mg') return x.dose / 1000;
  return x.servingG ? x.servingG * x.dose : null;
}

/** Energy and macros in one dose, added to the day when it is ticked. */
export function doseNutrients(x: Supplement): Nutrients | null {
  const g = doseGrams(x);
  if (!x.per100 || g === null) return null;
  const f = g / 100;
  return { kcal: Math.round(x.per100.kcal * f), protein: +(x.per100.protein * f).toFixed(1), carbs: +(x.per100.carbs * f).toFixed(1), fat: +(x.per100.fat * f).toFixed(1) };
}

/** Vitamins and minerals in one dose, in the label's units. */
export function doseMicros(x: Supplement) {
  const g = doseGrams(x);
  const scale = (unit: string) => (unit === 'mg' ? 1e3 : unit === 'µg' ? 1e6 : 1);
  return x.micros.flatMap((m) => {
    const grams = COUNTED.includes(x.unit) && m.perServing !== null ? m.perServing * x.dose : m.per100 !== null && g !== null ? (m.per100 * g) / 100 : null;
    if (grams === null || grams <= 0) return [];
    const amount = grams * scale(m.unit);
    return [{ label: m.label, amount: amount >= 10 ? Math.round(amount) : +amount.toPrecision(2), unit: m.unit }];
  });
}

export function formatDose(x: Pick<Supplement, 'dose' | 'unit'>) {
  const n = +x.dose.toFixed(2);
  return COUNTED.includes(x.unit) ? `${n} ${x.unit}${n === 1 ? '' : 's'}` : `${n} ${x.unit}`;
}

const day = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export interface Reminder { id: string; at: Date; title: string; body: string }

/**
 * One reminder per reminder time per day for the next days, skipping a day once everything due at that
 * time is ticked. Rebuilt whenever supplements or ticks change and when the app opens.
 */
export function reminderPlan(supplements: Supplement[], intakes: Intake[], now: Date, days = 14, max = 60): Reminder[] {
  const times = [...new Set(supplements.map((x) => x.time).filter(Boolean) as string[])].sort();
  const out: Reminder[] = [];
  for (let d = 0; d < days; d++) {
    for (const time of times) {
      const [h, m] = time.split(':').map(Number);
      const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, h, m, 0, 0);
      if (at <= now) continue;
      const date = day(at);
      const due = supplements.filter((x) => x.time === time && !intakes.some((i) => i.supplementId === x.id && i.date === date));
      if (!due.length) continue;
      out.push({ id: `intake-${date}-${time.replace(':', '')}`, at, title: 'Daily intake', body: due.map((x) => `${x.name} · ${formatDose(x)}`).join('\n') });
    }
  }
  return out.slice(0, max);
}

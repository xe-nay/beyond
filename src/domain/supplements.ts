// Daily supplements: what a dose holds, how it reads, and when to remind. Pure functions.
import { fromGrams, MICRO, MICROS, microsFromOff } from './micros.ts';
import type { DoseUnit, Intake, Micro, Nutrients, Supplement } from './types.ts';

export const UNITS: DoseUnit[] = ['g', 'mg', 'ml', 'capsule', 'tablet', 'scoop', 'drop'];
const COUNTED: DoseUnit[] = ['capsule', 'tablet', 'scoop', 'drop'];

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(+v) ? +v : null);

/** What the label tells us about a scanned supplement. Unlike food, it may have no energy value at all. */
export function supplementFromOff(p: any): Pick<Supplement, 'name' | 'brand' | 'image' | 'barcode' | 'per100' | 'servingG' | 'micros' | 'serving'> & { servingLabel: string | null } | null {
  const name = (p?.product_name || p?.product_name_en || p?.generic_name || '').trim();
  if (!name) return null;
  const n = p.nutriments ?? {};
  const kcal = num(n['energy-kcal_100g']) ?? (num(n['energy_100g']) !== null ? num(n['energy_100g'])! / 4.184 : null);
  const micro100 = microsFromOff(n);
  const per100 = kcal === null && num(n.proteins_100g) === null && !micro100 ? null : {
    kcal: Math.round(kcal ?? 0), protein: num(n.proteins_100g) ?? 0, carbs: num(n.carbohydrates_100g) ?? 0, fat: num(n.fat_100g) ?? 0, micro: micro100,
  };
  const serving: Record<string, number> = {};
  for (const m of MICROS) {
    const v = m.off ? num(n[`${m.off}_serving`]) : null;
    if (v !== null && v > 0) serving[m.key] = fromGrams(v, m.unit);
  }
  const brand = Array.isArray(p.brands) ? p.brands[0] : (p.brands ?? '').split(',')[0]?.trim() || null;
  return {
    name, brand, image: p.image_front_url ?? p.image_front_small_url ?? null, barcode: p.code ? String(p.code) : null,
    per100, servingG: num(p.serving_quantity), micros: [], serving: Object.keys(serving).length ? serving : undefined, servingLabel: p.serving_size ?? null,
  };
}

/** Grams in one daily dose, when it can be known (1 ml counted as 1 g). */
export function doseGrams(x: Pick<Supplement, 'dose' | 'unit' | 'servingG'>) {
  if (x.unit === 'g' || x.unit === 'ml') return x.dose;
  if (x.unit === 'mg') return x.dose / 1000;
  return x.servingG ? x.servingG * x.dose : null;
}

/** Every label value in one daily dose, by micronutrient key, in that nutrient's unit. */
export function doseValues(x: Supplement): Record<string, number> {
  const g = doseGrams(x);
  const out: Record<string, number> = {};
  const servings = COUNTED.includes(x.unit) ? x.dose : g !== null && x.servingG ? g / x.servingG : null;
  if (x.serving && servings !== null) for (const [k, v] of Object.entries(x.serving)) out[k] = v * servings;
  if (x.per100?.micro && g !== null) for (const [k, v] of Object.entries(x.per100.micro)) out[k] ??= (v * g) / 100;
  // Older entries kept Open Food Facts values in grams.
  for (const m of x.micros ?? []) {
    const def = MICROS.find((d) => d.off === m.key);
    if (!def || out[def.key] !== undefined) continue;
    const grams = COUNTED.includes(x.unit) && m.perServing !== null ? m.perServing * x.dose : m.per100 !== null && g !== null ? (m.per100 * g) / 100 : null;
    if (grams !== null && grams > 0) out[def.key] = fromGrams(grams, def.unit);
  }
  // A creatine powder is creatine: the dose in grams is the creatine taken.
  if (out.creatine === undefined && /creatin/i.test(x.name) && g !== null) out.creatine = g;
  Object.assign(out, x.custom ?? {});
  for (const k of Object.keys(out)) if (!(out[k] > 0)) delete out[k];
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v >= 10 ? Math.round(v) : +v.toPrecision(3)]));
}

/** What one dose adds to the day: energy and macros when the label has them, and every label value. */
export function doseNutrients(x: Supplement): Nutrients | null {
  const g = doseGrams(x);
  const micro = doseValues(x);
  const f = x.per100 && g !== null ? g / 100 : 0;
  const macros = { kcal: Math.round((x.per100?.kcal ?? 0) * f), protein: +((x.per100?.protein ?? 0) * f).toFixed(1), carbs: +((x.per100?.carbs ?? 0) * f).toFixed(1), fat: +((x.per100?.fat ?? 0) * f).toFixed(1) };
  if (!Object.keys(micro).length && !macros.kcal && !macros.protein) return null;
  return Object.keys(micro).length ? { ...macros, micro } : macros;
}

/** Label values in one dose, for showing. */
export function doseMicros(x: Supplement) {
  return Object.entries(doseValues(x)).flatMap(([k, amount]) => (MICRO[k] ? [{ key: k, label: MICRO[k].label, amount, unit: MICRO[k].unit }] : []));
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

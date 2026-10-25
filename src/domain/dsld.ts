// NIH Dietary Supplement Label Database (DSLD): free, no key, US supplement labels with the amount of
// each ingredient per serving. Used when Open Food Facts does not know a supplement.
import { MICRO } from './micros.ts';

const API = 'https://api.ods.od.nih.gov/dsld/v9';

export interface DsldHit { id: string; name: string; brand: string | null }

export async function searchDsld(q: string, signal?: AbortSignal): Promise<DsldHit[]> {
  const res = await fetch(`${API}/search-filter?q=${encodeURIComponent(q)}&size=20`, { signal });
  const body = await res.json();
  return (body.hits ?? []).map((h: any) => ({ id: String(h._id), name: h._source?.fullName ?? '', brand: h._source?.brandName ?? null })).filter((h: DsldHit) => h.name);
}

/** Ingredient names on labels, to the app's micronutrient keys. */
const NAMES: [RegExp, string][] = [
  [/creatine/i, 'creatine'], [/caffeine/i, 'caffeine'], [/vitamin a\b|retinol|beta.?carotene/i, 'vitaminA'], [/vitamin c|ascorbic/i, 'vitaminC'],
  [/vitamin d|cholecalciferol|ergocalciferol/i, 'vitaminD'], [/vitamin e|tocopher/i, 'vitaminE'], [/vitamin k|phylloquinone|menaquinone/i, 'vitaminK'],
  [/thiamin|vitamin b-?1\b/i, 'b1'], [/riboflavin|vitamin b-?2\b/i, 'b2'], [/niacin|vitamin b-?3\b/i, 'b3'], [/vitamin b-?6|pyridox/i, 'b6'],
  [/folate|folic/i, 'folate'], [/vitamin b-?12|cobalamin/i, 'b12'], [/calcium/i, 'calcium'], [/magnesium/i, 'magnesium'], [/zinc/i, 'zinc'],
  [/iron\b/i, 'iron'], [/potassium/i, 'potassium'], [/sodium/i, 'sodium'], [/selenium/i, 'selenium'], [/iodine|iodide/i, 'iodine'],
  [/phosphorus/i, 'phosphorus'], [/omega.?3|\bepa\b|\bdha\b|eicosapent|docosahex/i, 'omega3'],
];

/** A label amount in the nutrient's own unit; IU converted for vitamins A, D and E. */
function toUnit(key: string, quantity: number, unit: string) {
  const u = unit.toLowerCase();
  const target = MICRO[key]?.unit;
  if (!target) return null;
  let g: number | null = null;
  if (/gram/.test(u) || u === 'g') g = quantity;
  else if (u === 'mg') g = quantity / 1e3;
  else if (u === 'mcg' || u === 'µg' || u === 'ug' || /mcg/.test(u)) g = quantity / 1e6;
  else if (u === 'iu') {
    if (key === 'vitaminD') g = (quantity * 0.025) / 1e6;
    else if (key === 'vitaminA') g = (quantity * 0.3) / 1e6;
    else if (key === 'vitaminE') g = (quantity * 0.67) / 1e3;
  }
  if (g === null) return null;
  return target === 'mg' ? g * 1e3 : target === 'µg' ? g * 1e6 : g;
}

/** One label: its name, serving and amounts per serving by micronutrient key. */
export async function dsldLabel(id: string, signal?: AbortSignal) {
  const res = await fetch(`${API}/label/${encodeURIComponent(id)}`, { signal });
  const j = await res.json();
  const serving: Record<string, number> = {};
  for (const row of j.ingredientRows ?? []) {
    const key = NAMES.find(([rx]) => rx.test(row.name ?? ''))?.[1];
    const q = row.quantity?.[0];
    if (!key || !q || !(q.quantity > 0)) continue;
    const v = toUnit(key, q.quantity, q.unit ?? '');
    if (v !== null) serving[key] = Math.round(((serving[key] ?? 0) + v) * 1000) / 1000;
  }
  const s = j.servingSizes?.[0];
  return {
    name: j.fullName as string,
    brand: (j.brandName as string) ?? null,
    servingLabel: s ? `${s.minQuantity} ${s.unit}${s.notes ? ` (${s.notes})` : ''}` : null,
    servingUnit: (s?.unit as string | undefined) ?? null,
    serving,
  };
}

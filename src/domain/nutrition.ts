// Open Food Facts lookup (free, ODbL, no key), portion math and starting targets.
import type { Food, Nutrients, NutritionTargets, Profile } from './types.ts';

const UA = 'Beyond/1.0 (personal iPhone app)';
const FIELDS = 'code,product_name,product_name_en,generic_name,brands,image_front_url,image_front_small_url,nutriments,serving_size,serving_quantity,nutriscore_grade,nova_group,product_quantity_unit,quantity';

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(+v) ? +v : null);

export function fromOff(p: any): Food | null {
  const n = p?.nutriments ?? {};
  const kcal = num(n['energy-kcal_100g']) ?? (num(n['energy_100g']) !== null ? num(n['energy_100g'])! / 4.184 : null);
  const protein = num(n.proteins_100g);
  const carbs = num(n.carbohydrates_100g);
  const fat = num(n.fat_100g);
  const name = (p?.product_name || p?.product_name_en || p?.generic_name || '').trim();
  if (!name || kcal === null) return null;
  const brand = Array.isArray(p.brands) ? p.brands[0] : (p.brands ?? '').split(',')[0]?.trim() || null;
  const ml = /ml|cl|l$/i.test(p.product_quantity_unit ?? '') || /\d\s*(ml|cl|l)\b/i.test(p.quantity ?? '');
  const code = String(p.code ?? '');
  return {
    id: code || `food-${name}`,
    barcode: code || null,
    name,
    brand,
    image: p.image_front_url ?? p.image_front_small_url ?? null,
    basis: ml ? 'ml' : 'g',
    per100: {
      kcal: Math.round(kcal),
      protein: protein ?? 0,
      carbs: carbs ?? 0,
      fat: fat ?? 0,
      sugar: num(n.sugars_100g),
      fiber: num(n.fiber_100g),
      salt: num(n.salt_100g),
      satFat: num(n['saturated-fat_100g']),
    },
    servingSize: num(p.serving_quantity),
    servingLabel: p.serving_size ?? null,
    nutriScore: typeof p.nutriscore_grade === 'string' && /^[a-e]$/.test(p.nutriscore_grade) ? p.nutriscore_grade : null,
    nova: num(p.nova_group),
    favorite: false,
    lastUsed: new Date().toISOString(),
  };
}

export type Lookup = { status: 'found'; food: Food } | { status: 'incomplete'; name: string | null } | { status: 'missing' } | { status: 'offline' };

export async function lookupBarcode(code: string, signal?: AbortSignal): Promise<Lookup> {
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}?fields=${FIELDS}`, {
      headers: { 'User-Agent': UA },
      signal,
    });
    if (res.status === 404) return { status: 'missing' };
    const body = await res.json();
    if (body.status !== 1 || !body.product) return { status: 'missing' };
    const food = fromOff({ ...body.product, code });
    return food ? { status: 'found', food } : { status: 'incomplete', name: body.product.product_name ?? null };
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e;
    return { status: 'offline' };
  }
}

export async function searchFoods(query: string, signal?: AbortSignal): Promise<Food[]> {
  const q = encodeURIComponent(query);
  try {
    const res = await fetch(`https://search.openfoodfacts.org/search?q=${q}&page_size=30&fields=${FIELDS}`, { headers: { 'User-Agent': UA }, signal });
    const body = await res.json();
    return (body.hits ?? []).map(fromOff).filter(Boolean) as Food[];
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e;
    // The classic endpoint is slower but a useful second chance.
    const res = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${q}&search_simple=1&json=1&page_size=30&fields=${FIELDS}`, { headers: { 'User-Agent': UA }, signal });
    const body = await res.json();
    return (body.products ?? []).map(fromOff).filter(Boolean) as Food[];
  }
}

export function scale(n: Nutrients, amount: number): Nutrients {
  const f = amount / 100;
  const r = (v: number | null | undefined, d = 1) => (v === null || v === undefined ? null : Math.round(v * f * 10 ** d) / 10 ** d);
  return { kcal: Math.round(n.kcal * f), protein: r(n.protein)!, carbs: r(n.carbs)!, fat: r(n.fat)!, sugar: r(n.sugar), fiber: r(n.fiber), salt: r(n.salt, 2), satFat: r(n.satFat) };
}

export const sum = (list: Nutrients[]): Nutrients =>
  list.reduce((a, b) => ({ kcal: a.kcal + b.kcal, protein: a.protein + b.protein, carbs: a.carbs + b.carbs, fat: a.fat + b.fat }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });

/** Share of energy from each macro (4/4/9 kcal per gram). */
export function macroSplit(n: Nutrients) {
  const p = n.protein * 4, c = n.carbs * 4, f = n.fat * 9;
  const t = p + c + f || 1;
  return { protein: p / t, carbs: c / t, fat: f / t };
}

/**
 * Starting targets. Resting energy from Mifflin–St Jeor (needs sex, age, height, weight),
 * times an activity factor from training days, adjusted for the goal. An estimate the user can override.
 */
export function startingTargets(profile: Profile, weightKg: number | null): NutritionTargets | null {
  if (!weightKg || !profile.heightCm || !profile.birthYear || !profile.sex) return null;
  const age = new Date().getFullYear() - profile.birthYear;
  const bmr = 10 * weightKg + 6.25 * profile.heightCm - 5 * age + (profile.sex === 'male' ? 5 : -161);
  const factor = 1.2 + Math.min(profile.days, 6) * 0.075;
  const adjust = { 'fat-loss': -0.2, recomposition: -0.1, hypertrophy: 0.08, strength: 0.05, general: 0, hybrid: 0 }[profile.goal];
  const kcal = Math.round((bmr * factor * (1 + adjust)) / 10) * 10;
  const protein = Math.round(weightKg * (profile.goal === 'fat-loss' ? 2.2 : 1.8));
  const fat = Math.round((kcal * 0.27) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal, protein, carbs, fat };
}

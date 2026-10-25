// USDA FoodData Central: public domain, branded products with barcodes and full label values, plus
// generic foods. Works with the public DEMO_KEY (a few dozen requests an hour per phone).
import { MICROS } from './micros.ts';
import type { Food } from './types.ts';

const API = 'https://api.nal.usda.gov/fdc/v1';
const KEY = 'DEMO_KEY';

const BASE: Record<number, 'kcal' | 'protein' | 'fat' | 'carbs' | 'sugar' | 'fiber' | 'satFat' | 'sodium'> = {
  1008: 'kcal', 1003: 'protein', 1004: 'fat', 1005: 'carbs', 2000: 'sugar', 1079: 'fiber', 1258: 'satFat', 1093: 'sodium',
};
const MICRO_BY_ID = new Map(MICROS.flatMap((m) => m.usda.map((id) => [id, m.key] as const)));

/** A FoodData Central result as a food, values per 100 g (or ml); null without energy. */
export function fromFdc(f: any): Food | null {
  const v: Record<string, number> = {};
  const micro: Record<string, number> = {};
  for (const n of f.foodNutrients ?? []) {
    const id = Number(n.nutrientId ?? n.nutrient?.id);
    const value = Number(n.value ?? n.amount);
    if (!Number.isFinite(value)) continue;
    if (BASE[id]) v[BASE[id]] = value;
    const key = MICRO_BY_ID.get(id);
    if (key && value > 0) micro[key] = Math.round(((micro[key] ?? 0) + value) * 1000) / 1000;
  }
  // Some branded entries only give energy in kJ (nutrient 1062).
  if (v.kcal === undefined) {
    const kj = (f.foodNutrients ?? []).find((n: any) => Number(n.nutrientId) === 1062)?.value;
    if (Number.isFinite(Number(kj))) v.kcal = Number(kj) / 4.184;
  }
  const name = String(f.description ?? '').trim();
  if (!name || v.kcal === undefined) return null;
  const pretty = name === name.toUpperCase() ? name.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()) : name;
  const ml = /ml|l$/i.test(String(f.servingSizeUnit ?? ''));
  const code = f.gtinUpc ? String(f.gtinUpc) : null;
  return {
    id: code ?? `fdc-${f.fdcId}`,
    barcode: code,
    name: pretty,
    brand: f.brandName || f.brandOwner || (f.dataType === 'Branded' ? null : 'USDA'),
    image: null,
    basis: ml ? 'ml' : 'g',
    per100: {
      kcal: Math.round(v.kcal), protein: v.protein ?? 0, carbs: v.carbs ?? 0, fat: v.fat ?? 0,
      sugar: v.sugar ?? null, fiber: v.fiber ?? null, satFat: v.satFat ?? null,
      salt: v.sodium !== undefined ? Math.round(v.sodium * 2.5) / 1000 : null,
      micro: Object.keys(micro).length ? micro : undefined,
    },
    servingSize: Number(f.servingSize) > 0 ? Number(f.servingSize) : null,
    servingLabel: f.householdServingFullText ?? null,
    nutriScore: null,
    nova: null,
    favorite: false,
    lastUsed: '',
  };
}

const same = (a: string, b: string) => a.replace(/^0+/, '') === b.replace(/^0+/, '');

/** A branded product by its barcode, or null. */
export async function fdcByBarcode(code: string, signal?: AbortSignal): Promise<Food | null> {
  const res = await fetch(`${API}/foods/search?query=${encodeURIComponent(code)}&dataType=Branded&pageSize=5&api_key=${KEY}`, { signal });
  if (!res.ok) return null;
  const body = await res.json();
  const hit = (body.foods ?? []).find((f: any) => f.gtinUpc && same(String(f.gtinUpc), code));
  return hit ? fromFdc({ ...hit, gtinUpc: code }) : null;
}

/** Foods by name: branded products and USDA's generic foods. */
export async function fdcSearch(query: string, signal?: AbortSignal): Promise<Food[]> {
  const res = await fetch(`${API}/foods/search?query=${encodeURIComponent(query)}&dataType=Branded,Foundation,Survey%20(FNDDS)&pageSize=20&api_key=${KEY}`, { signal });
  if (!res.ok) return [];
  const body = await res.json();
  return (body.foods ?? []).map(fromFdc).filter(Boolean) as Food[];
}

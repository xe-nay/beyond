// Everyday foods without a barcode, built by scripts/build-basic-foods.py from USDA FoodData Central
// SR Legacy (public domain). Available offline.
import raw from './data/basic-foods.json';
import type { Food } from './domain/types';

interface Basic { id: string; name: string; per100: Food['per100']; serving: number | null; servingLabel: string | null }

export const basicFoods: Food[] = (raw as Basic[]).map((b) => ({
  id: b.id,
  barcode: null,
  name: b.name,
  brand: 'Basic food',
  image: null,
  basis: 'g',
  per100: b.per100,
  servingSize: b.serving,
  servingLabel: b.servingLabel ?? (b.serving ? `${b.serving} g` : null),
  nutriScore: null,
  nova: null,
  favorite: false,
  lastUsed: '',
}));

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[^a-z0-9 ]/g, ' ');
export function searchBasics(q: string) {
  const words = norm(q).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return basicFoods.filter((f) => words.every((w) => norm(f.name).split(/\s+/).some((n) => n.startsWith(w))));
}

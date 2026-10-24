// Weight conversion and plate math for the barbell and dumbbell visuals.
import type { Unit } from './types.ts';

export const LB = 2.2046226218;
export const toDisplay = (kg: number, unit: Unit) => (unit === 'kg' ? kg : kg * LB);
export const toKg = (value: number, unit: Unit) => (unit === 'kg' ? value : value / LB);

/** Rounds a display weight to the step a gym can actually load. */
export const roundTo = (value: number, step: number) => Math.round(value / step) * step;
export const formatWeight = (kg: number, unit: Unit) => {
  const v = toDisplay(kg, unit);
  return `${Number.isInteger(roundTo(v, 0.5)) ? roundTo(v, 0.5) : roundTo(v, 0.5).toFixed(1)}`;
};

export interface Plate {
  weight: number; // in the plate set's own unit
  color: string;
  height: number; // relative diameter, 1 = full size
  thickness: number; // relative
}

// Competition colours (IWF) for kilograms; plain iron greys for pounds, as most gyms use.
export const PLATES: Record<Unit, Plate[]> = {
  kg: [
    { weight: 25, color: '#E5383B', height: 1, thickness: 1 },
    { weight: 20, color: '#2F6BFF', height: 1, thickness: 0.9 },
    { weight: 15, color: '#F2C230', height: 1, thickness: 0.78 },
    { weight: 10, color: '#2FBF71', height: 1, thickness: 0.66 },
    { weight: 5, color: '#E8ECF2', height: 0.74, thickness: 0.5 },
    { weight: 2.5, color: '#E5383B', height: 0.62, thickness: 0.42 },
    { weight: 2, color: '#2F6BFF', height: 0.58, thickness: 0.4 },
    { weight: 1.5, color: '#F2C230', height: 0.54, thickness: 0.36 },
    { weight: 1.25, color: '#B7C0CC', height: 0.5, thickness: 0.34 },
    { weight: 1, color: '#2FBF71', height: 0.48, thickness: 0.3 },
    { weight: 0.5, color: '#E8ECF2', height: 0.42, thickness: 0.26 },
  ],
  lb: [
    { weight: 45, color: '#3A4558', height: 1, thickness: 1 },
    { weight: 35, color: '#3A4558', height: 0.92, thickness: 0.9 },
    { weight: 25, color: '#3A4558', height: 0.8, thickness: 0.74 },
    { weight: 10, color: '#4A566B', height: 0.62, thickness: 0.5 },
    { weight: 5, color: '#56637A', height: 0.5, thickness: 0.42 },
    { weight: 2.5, color: '#63718A', height: 0.42, thickness: 0.34 },
  ],
};

export const BARS: Record<Unit, number> = { kg: 20, lb: 45 };

export interface Loadout {
  bar: number;
  perSide: Plate[];
  loaded: number; // total actually on the bar, in the unit
  missing: number; // what could not be made with the plates, in the unit
}

/** Greedy plate loading per side, heaviest first. Works in the chosen unit's own plates. */
export function loadBarbell(total: number, unit: Unit, bar = BARS[unit], available = PLATES[unit]): Loadout {
  let side = Math.max(0, (total - bar) / 2);
  const perSide: Plate[] = [];
  for (const plate of available) {
    while (side + 1e-9 >= plate.weight && perSide.length < 12) {
      perSide.push(plate);
      side -= plate.weight;
    }
  }
  const loaded = bar + 2 * perSide.reduce((n, p) => n + p.weight, 0);
  return { bar, perSide, loaded: Math.max(loaded, bar), missing: Math.max(0, roundTo(total - loaded, 0.01)) };
}

/** Typical fixed dumbbell steps in each unit, used to snap a dumbbell weight. */
export function dumbbellStep(unit: Unit, value: number) {
  if (unit === 'lb') return value < 25 ? 2.5 : 5;
  return value < 10 ? 1 : value < 40 ? 2 : 2.5;
}

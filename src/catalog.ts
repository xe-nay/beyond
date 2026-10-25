// The exercise catalog, generated at build time by scripts/build-exercises.mjs.
import raw from './data/exercises.json';
import type { Equipment, Exercise, Region } from './domain/types';

export const exercises = raw as unknown as Exercise[];
export const byId: Record<string, Exercise> = Object.fromEntries(exercises.map((e) => [e.id, e]));
export const exercise = (id: string) => byId[id];

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  barbell: 'Barbell', 'ez-bar': 'EZ bar', smith: 'Smith', 'trap-bar': 'Trap bar', dumbbell: 'Dumbbell',
  kettlebell: 'Kettlebell', cable: 'Cable', machine: 'Machine', band: 'Band', plate: 'Plate', ball: 'Ball',
  bodyweight: 'Bodyweight', other: 'Other',
};

/** How the load is shown and stepped in a workout. */
export type LoadKind = 'barbell' | 'dumbbell' | 'kettlebell' | 'stack' | 'bodyweight';
export function loadKind(e: Exercise | undefined): LoadKind {
  if (!e) return 'stack';
  if (['barbell', 'ez-bar', 'smith', 'trap-bar'].includes(e.equipment)) return 'barbell';
  if (e.equipment === 'dumbbell') return 'dumbbell';
  if (e.equipment === 'kettlebell') return 'kettlebell';
  if (e.equipment === 'bodyweight' || e.equipment === 'band') return 'bodyweight';
  return 'stack';
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[^a-z0-9 ]/g, ' ');
const haystack = new Map(exercises.map((e) => [e.id, norm(`${e.name} ${e.equipment} ${e.muscles.join(' ')} ${e.group ?? ''}`)]));

export function search(query: string, filters: { region?: Region | null; equipment?: Equipment | null; home?: boolean } = {}) {
  const words = norm(query).split(/\s+/).filter(Boolean);
  return exercises
    .filter((e) =>
      (!filters.region || e.primary.includes(filters.region)) &&
      (!filters.equipment || e.equipment === filters.equipment) &&
      (!filters.home || ['bodyweight', 'dumbbell', 'kettlebell', 'band', 'ball'].includes(e.equipment)) &&
      words.every((w) => haystack.get(e.id)!.includes(w)),
    )
    .sort((a, b) => (a.src === b.src ? 0 : a.src === 'r' ? -1 : 1));
}

export { defaultImplements } from './domain/equipment';

// Deterministic program generation from the profile and a curated movement-pattern table.
import type { Equipment, Exercise, Goal, Experience, Prescription, Profile, Program, ProgramDay } from './types.ts';

type Pattern =
  | 'squat' | 'hinge' | 'lunge' | 'hpush' | 'vpush' | 'hpull' | 'vpull' | 'fly'
  | 'lateral' | 'curl' | 'triceps' | 'legcurl' | 'legext' | 'calf' | 'core' | 'glute' | 'reardelt';

// Preferred exercises per pattern, best first. The first one the user's equipment allows wins.
const PATTERNS: Record<Pattern, string[]> = {
  squat: ['squat', 'front-squat', 'leg-press', 'db-squat', 'goblet-squat', 'kettlebell-squat', 'banded-squat', 'f-bodyweight-squat'],
  hinge: ['romanian-deadlift', 'deadlift', 'single-leg-romanian-deadlift', 'cable-pull-through', 'banded-romanian-deadlift', 'single-leg-rdl-hold'],
  lunge: ['bulgarian-split-squat', 'db-lunge', 'walking-lunge', 'kettlebell-reverse-lunge', 'split-squat', 'step-ups'],
  hpush: ['bench-press', 'db-bench-press', 'incline-db-press', 'cable-chest-press', 'dumbbell-floor-press', 'kettlebell-floor-press', 'push-up'],
  vpush: ['dumbbell-shoulder-press', 'machine-shoulder-press', 'arnold-press', 'one-arm-kettlebell-shoulder-press', 'pike-push-ups'],
  hpull: ['barbell-row', 'seated-cable-row', 'bent-over-db-row', 'one-arm-kettlebell-row', 'inverted-row', 'band-pull-apart'],
  vpull: ['pull-up', 'lat-pulldown', 'chin-ups', 'close-grip-lat-pulldown', 'band-assisted-pull-ups'],
  fly: ['cable-fly', 'machine-chest-fly', 'incline-dumbbell-fly', 'pec-deck', 'incline-push-ups'],
  lateral: ['lateral-raise', 'cable-lateral-raise', 'seated-dumbbell-lateral-raise'],
  reardelt: ['face-pull', 'machine-reverse-fly', 'dumbbell-face-pull', 'band-pull-apart'],
  curl: ['barbell-curl', 'incline-db-curl', 'hammer-curl', 'cable-curl', 'kettlebell-hammer-curl', 'banded-standing-curl'],
  triceps: ['tricep-pushdown', 'skull-crusher', 'cable-overhead-tricep-extension', 'dumbbell-tricep-extension', 'kettlebell-overhead-tricep-extension', 'dips'],
  legcurl: ['seated-leg-curl', 'leg-curl', 'ball-leg-curl', 'nordic-hamstring-curl'],
  legext: ['leg-extension', 'single-leg-extension'],
  calf: ['standing-calf-raise', 'seated-calf-raise', 'dumbbell-calf-raise', 'single-leg-calf-raise'],
  glute: ['hip-thrust', 'glute-bridge', 'single-leg-glute-bridge', 'banded-hip-thrust'],
  core: ['cable-crunch', 'hanging-leg-raise', 'ab-wheel-rollout', 'plank', 'crunches', 'dead-bug'],
};

const COMPOUND = new Set<Pattern>(['squat', 'hinge', 'lunge', 'hpush', 'vpush', 'hpull', 'vpull']);

export const SPLITS = {
  full: [
    ['squat', 'hpush', 'hpull', 'hinge', 'lateral', 'core'],
    ['hinge', 'vpush', 'vpull', 'lunge', 'curl', 'triceps'],
    ['squat', 'hpush', 'hpull', 'glute', 'reardelt', 'calf'],
  ],
  upperLower: [
    ['hpush', 'hpull', 'vpush', 'vpull', 'lateral', 'curl', 'triceps'],
    ['squat', 'hinge', 'lunge', 'legcurl', 'calf', 'core'],
    ['vpush', 'vpull', 'hpush', 'hpull', 'reardelt', 'triceps', 'curl'],
    ['hinge', 'squat', 'glute', 'legext', 'calf', 'core'],
  ],
  ppl: [
    ['hpush', 'vpush', 'fly', 'lateral', 'triceps'],
    ['vpull', 'hpull', 'reardelt', 'curl', 'core'],
    ['squat', 'hinge', 'lunge', 'legcurl', 'calf'],
  ],
} satisfies Record<string, Pattern[][]>;

const WEEKDAYS: Record<number, number[]> = {
  1: [0], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5], 7: [0, 1, 2, 3, 4, 5, 6],
};

const BARBELLISH: Equipment[] = ['barbell', 'ez-bar', 'smith', 'trap-bar'];
export function allowed(e: Exercise, equipment: Equipment[]) {
  if (e.equipment === 'bodyweight' || e.equipment === 'other' && e.category === 'stretching') return true;
  if (BARBELLISH.includes(e.equipment)) return equipment.includes('barbell') || equipment.includes(e.equipment);
  return equipment.includes(e.equipment);
}

export function prescribe(exerciseId: string, pattern: Pattern | null, goal: Goal, experience: Experience): Prescription {
  const compound = pattern ? COMPOUND.has(pattern) : false;
  const strength = goal === 'strength' && compound;
  return {
    exerciseId,
    sets: experience === 'beginner' ? 2 : experience === 'advanced' && compound ? 4 : 3,
    minReps: strength ? 3 : compound ? 6 : 10,
    maxReps: strength ? 6 : compound ? 10 : 15,
    rir: strength ? 2 : experience === 'beginner' ? 3 : 2,
    restSeconds: strength ? 180 : compound ? 150 : 90,
    loadKg: null,
    warmupSets: compound ? 2 : 0,
  };
}

export function generateProgram(profile: Profile, byId: Record<string, Exercise>, id = `p-${Date.now()}`): Program {
  const days = Math.min(7, Math.max(1, profile.days));
  const split = days <= 3 ? SPLITS.full : days === 4 ? SPLITS.upperLower : SPLITS.ppl;
  const names = days <= 3 ? ['Full body A', 'Full body B', 'Full body C'] : days === 4 ? ['Upper A', 'Lower A', 'Upper B', 'Lower B'] : ['Push', 'Pull', 'Legs'];
  const perDay = Math.max(3, Math.min(7, Math.round(profile.minutes / 9)));
  const program: ProgramDay[] = WEEKDAYS[days].map((weekday, i) => {
    const used = new Set<string>();
    const exercises = split[i % split.length].slice(0, perDay).flatMap((pattern) => {
      const pick = PATTERNS[pattern].find((x) => byId[x] && !used.has(x) && allowed(byId[x], profile.equipment));
      if (!pick) return [];
      used.add(pick);
      return [prescribe(pick, pattern, profile.goal, profile.experience)];
    });
    const round = Math.floor(i / split.length);
    return { id: `d${i}`, name: names[i % names.length] + (days > 3 && round ? ' 2' : ''), weekday, exercises };
  });
  return {
    id,
    name: days <= 3 ? 'Full Body' : days === 4 ? 'Upper / Lower' : 'Push Pull Legs',
    createdAt: new Date().toISOString(),
    days: program,
    deloadEvery: profile.experience === 'beginner' ? null : 6,
    notes: [`${days} days · about ${profile.minutes} min`, 'Loads are set by you, never guessed from body weight.'],
  };
}

export interface Template { id: string; name: string; detail: string; profile: Partial<Profile> }
const GYM: Equipment[] = ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'kettlebell', 'band'];
export const TEMPLATES: Template[] = [
  { id: 'full', name: 'Full Body', detail: '3 days', profile: { days: 3, minutes: 50, goal: 'general', equipment: GYM } },
  { id: 'ul', name: 'Upper / Lower', detail: '4 days', profile: { days: 4, minutes: 60, goal: 'hypertrophy', equipment: GYM } },
  { id: 'ppl', name: 'Push Pull Legs', detail: '6 days', profile: { days: 6, minutes: 60, goal: 'hypertrophy', experience: 'advanced', equipment: GYM } },
  { id: 'h4', name: 'Hypertrophy 4', detail: '4 days', profile: { days: 4, minutes: 70, goal: 'hypertrophy', equipment: GYM } },
  { id: 'h5', name: 'Hypertrophy 5', detail: '5 days', profile: { days: 5, minutes: 60, goal: 'hypertrophy', equipment: GYM } },
  { id: 'str', name: 'Strength', detail: '3 days · low reps', profile: { days: 3, minutes: 70, goal: 'strength', equipment: GYM } },
  { id: 'home1', name: 'Home Starter', detail: '2 days · bodyweight', profile: { days: 2, minutes: 30, goal: 'general', experience: 'beginner', equipment: ['bodyweight', 'band'] } },
  { id: 'home2', name: 'Home Builder', detail: '3 days · dumbbells', profile: { days: 3, minutes: 45, goal: 'hypertrophy', equipment: ['bodyweight', 'dumbbell', 'band'] } },
  { id: 'db', name: 'Dumbbells Only', detail: '3 days', profile: { days: 3, minutes: 45, goal: 'hypertrophy', equipment: ['bodyweight', 'dumbbell'] } },
  { id: 'bw', name: 'Calisthenics', detail: '3 days', profile: { days: 3, minutes: 45, goal: 'general', equipment: ['bodyweight'] } },
  { id: 'hybrid', name: 'Strength + Cardio', detail: '3 + cardio', profile: { days: 3, minutes: 45, goal: 'hybrid', equipment: GYM } },
  { id: 'quick', name: 'Express', detail: '2 × 30 min', profile: { days: 2, minutes: 30, goal: 'general', equipment: ['bodyweight', 'dumbbell'] } },
];

/** Alternatives ranked by shared primary regions, then pattern group and equipment fit. */
export function substitutes(e: Exercise, all: Exercise[], equipment: Equipment[], limit = 8) {
  return all
    .filter((x) => x.id !== e.id && x.category === e.category && x.primary.some((r) => e.primary.includes(r)) && allowed(x, equipment))
    .map((x) => ({
      x,
      score:
        x.primary.filter((r) => e.primary.includes(r)).length * 3 -
        x.primary.filter((r) => !e.primary.includes(r)).length +
        (x.group && x.group === e.group ? 4 : 0) +
        (x.src === 'r' ? 1 : 0) +
        (x.equipment === e.equipment ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.x);
}

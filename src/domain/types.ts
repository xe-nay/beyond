// Shared data model. Every weight is stored in kilograms; the UI converts for display.

export type Region =
  | 'chest' | 'deltoids' | 'biceps' | 'triceps' | 'forearm' | 'abs' | 'obliques'
  | 'trapezius' | 'upper-back' | 'lower-back' | 'gluteal' | 'quadriceps'
  | 'hamstring' | 'adductors' | 'calves' | 'tibialis' | 'neck';

export type Equipment =
  | 'barbell' | 'ez-bar' | 'smith' | 'trap-bar' | 'dumbbell' | 'kettlebell' | 'cable'
  | 'machine' | 'band' | 'plate' | 'ball' | 'bodyweight' | 'other';

export interface Exercise {
  id: string;
  name: string;
  src: 'r' | 'f';
  category: string;
  equipment: Equipment;
  primary: Region[];
  secondary: Region[];
  muscles: string[];
  level: string;
  mechanic: string | null;
  force: string | null;
  unilateral: boolean;
  group: string | null;
  description: string;
  steps: string[];
  tips: string[];
  met: number | null;
  images: string[];
}

export type Unit = 'kg' | 'lb';
export type Goal = 'hypertrophy' | 'strength' | 'fat-loss' | 'recomposition' | 'general' | 'hybrid';
export type Experience = 'beginner' | 'intermediate' | 'advanced';

export interface Profile {
  name: string;
  unit: Unit;
  goal: Goal;
  experience: Experience;
  days: number;
  minutes: number;
  equipment: Equipment[];
  sex: 'male' | 'female' | null;
  birthYear: number | null;
  heightCm: number | null;
  onboarded: boolean;
}

export type Cue = 'beeps' | 'letsgo' | 'drill' | 'goggins' | 'ronnie' | 'sulek';

export interface TimerSettings {
  autoStart: boolean;
  sound: boolean;
  volume: number;
  countdown: number; // seconds of beeps before the end; 0 = only the end tone
  haptics: boolean;
  cue: Cue; // what plays near the end of a rest
  defaultRest?: number; // seconds, for exercises added outside a program
  muted?: string[]; // voice clips the user removed from rotation
  pauseMusic?: boolean; // pause other audio during voice clips instead of lowering it
  voiceCoach?: boolean; // cardio: spoken phases, rounds left and pace; default on
  voiceId?: string; // the English voice the coach speaks with; default the best male one
}

export interface Prescription {
  exerciseId: string;
  sets: number;
  minReps: number;
  maxReps: number;
  rir: number;
  restSeconds: number;
  loadKg: number | null;
  warmupSets?: number;
  superset?: string;
}

export interface ProgramDay {
  id: string;
  name: string;
  weekday: number; // 0 = Monday
  exercises: Prescription[];
}

export interface Program {
  id: string;
  name: string;
  createdAt: string;
  days: ProgramDay[];
  deloadEvery: number | null; // weeks
  notes: string[];
  from?: string; // first date it plans (YYYY-MM-DD); open when missing
  until?: string | null; // last date it plans; null or missing: ongoing
}

export interface WorkoutSet {
  id: string;
  exerciseId: string;
  reps: number;
  loadKg: number;
  rir: number | null;
  warmup: boolean;
  implements?: 1 | 2; // dumbbells or kettlebells used at once; loadKg is per implement
  completedAt: string;
  restSeconds: number | null; // measured rest before this set
}

export interface Session {
  id: string;
  programId: string | null;
  dayId: string | null;
  name: string;
  date: string; // YYYY-MM-DD
  plan: Prescription[];
  sets: WorkoutSet[];
  startedAt: string | null;
  finishedAt: string | null;
  sessionRpe: number | null;
  notes: string;
  source?: 'app' | 'import';
  /** Values being entered per exercise, kept so a closed app resumes exactly where it was. */
  drafts?: Record<string, { kg: number; reps: number; rir: number | null; warmup: boolean; implements: 1 | 2 }>;
}

/** A pace window in seconds per km: `fast` is the quickest allowed, `slow` the slowest (equal for one target). */
export interface PaceRange { fast: number; slow: number }

export interface IntervalPlan {
  activity: string;
  warmupSeconds: number;
  workSeconds: number;
  recoverySeconds: number;
  rounds: number;
  cooldownSeconds: number;
  workCue: string;
  recoveryCue: string;
  warmupCue?: string;
  cooldownCue?: string;
  countdown: number;
  /** Pace targets per phase. Without one, a pace written in that phase's cue ("4:30 /km") is used. */
  warmupPace?: PaceRange | null;
  workPace?: PaceRange | null;
  recoveryPace?: PaceRange | null;
  cooldownPace?: PaceRange | null;
  paceUnit?: 'km' | 'mi'; // how paces are shown and spoken
}

/** A cardio workout the user saved to reuse. */
export interface SavedCardio { id: string; name: string; plan: IntervalPlan }

export interface CardioSession {
  id: string;
  date: string;
  activity: string;
  name?: string; // from an imported plan, such as "Easy walk - 25 minutes"
  minutes: number;
  distanceKm: number | null;
  rpe: number | null;
  avgHr: number | null;
  plan: IntervalPlan | null;
  completed: boolean;
  notes: string;
}

export interface Nutrients {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar?: number | null;
  fiber?: number | null;
  salt?: number | null;
  satFat?: number | null;
  micro?: Record<string, number>; // by micros.ts key, in that nutrient's unit
}

export interface Food {
  id: string; // barcode, or 'search-<code>'
  barcode: string | null;
  name: string;
  brand: string | null;
  image: string | null;
  basis: 'g' | 'ml';
  per100: Nutrients;
  servingSize: number | null; // in basis units
  servingLabel: string | null;
  nutriScore: string | null;
  nova: number | null;
  favorite: boolean;
  lastUsed: string;
}

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface FoodEntry {
  id: string;
  date: string;
  meal: Meal;
  foodId: string;
  name: string;
  brand: string | null;
  image: string | null;
  amount: number; // in basis units
  basis: 'g' | 'ml';
  nutrients: Nutrients; // for the eaten amount, frozen at log time
  loggedAt: string;
  time?: string; // "HH:MM" when it was eaten, or will be: a later time is a planned meal
}

export interface NutritionTargets {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface BodyEntry {
  id: string;
  date: string;
  weightKg: number | null;
  waistCm: number | null;
  chestCm: number | null;
  armCm: number | null;
  thighCm: number | null;
  photo: string | null; // local file URI, never uploaded
}

export interface RecoveryCheck {
  date: string;
  energy: number; // 1-5
  soreness: number; // 1-5
  sleepHours: number;
}

export type DoseUnit = 'g' | 'mg' | 'ml' | 'capsule' | 'tablet' | 'scoop' | 'drop';

/** A label value from the product, such as Vitamin D. Amounts are in grams, as Open Food Facts stores them. */
export interface Micro { key: string; label: string; unit: string; per100: number | null; perServing: number | null }

/** Something taken every day (creatine, a multivitamin), set up once from its barcode. */
export interface Supplement {
  id: string;
  name: string;
  brand: string | null;
  image: string | null;
  barcode: string | null;
  dose: number;
  unit: DoseUnit;
  time: string | null; // "HH:MM" daily reminder, or null for none
  per100: Nutrients | null; // per 100 g/ml when the label has it
  servingG: number | null; // grams in one capsule/tablet/scoop, from the label
  micros: Micro[]; // label values from Open Food Facts, in grams (older entries)
  serving?: Record<string, number>; // per one capsule, tablet or scoop (or servingG grams), by micronutrient key
  custom?: Record<string, number>; // per daily dose, typed by the user; wins over the label
  createdAt: string;
}

export interface Intake {
  id: string;
  date: string;
  supplementId: string;
  name: string; // kept so history still reads well after a supplement is removed
  dose: string; // "5 g", "1 capsule"
  takenAt: string;
  nutrients: Nutrients | null; // frozen when ticked, counted in the day's totals
}

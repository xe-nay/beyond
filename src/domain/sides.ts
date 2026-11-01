// One-sided exercises (a single arm or leg at a time): each side gets its own reps, and its own weight
// when they differ. A set keeps both sides; its loadKg and reps are the weaker side's, so strength
// figures (e1RM, records) stay honest, while volume counts every rep of both sides.
import type { Exercise, WorkoutSet } from './types';

const ONE_SIDE = /single[- ]arm|one[- ]arm|single[- ]leg|one[- ]leg|alternat|split squat|lunge|step[- ]?up|pistol|kickback|concentration curl|suitcase/i;
const NOT = /carry|pose|hold|stretch|warrior|plank/i;

/** Whether an exercise is done one side at a time (the catalog's flag, or its name says so). */
export function eachSide(e: Exercise | undefined) {
  if (!e || e.category !== 'strength' || e.force === 'static' || NOT.test(e.name)) return false;
  return !!e.unilateral || ONE_SIDE.test(e.name);
}

export type Sides = NonNullable<WorkoutSet['sides']>;

/** A set's reps as shown: "10|9" for left|right. */
export const repsText = (s: Pick<WorkoutSet, 'reps' | 'sides'>) => (s.sides ? `${s.sides.l.reps}|${s.sides.r.reps}` : `${s.reps}`);

/** Both sides from what was entered: the weaker side becomes the set's load and reps. */
export function fromSides(l: { kg: number; reps: number }, r: { kg: number; reps: number }) {
  return { sides: { l, r }, loadKg: Math.min(l.kg, r.kg), reps: Math.min(l.reps, r.reps) };
}

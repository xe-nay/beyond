import type { Exercise } from './types.ts';

/** Dumbbells/kettlebells held at once by default: one for one-arm, single-leg and goblet work, else two. */
export function defaultImplements(e: Exercise | undefined): 1 | 2 {
  if (!e || !['dumbbell', 'kettlebell'].includes(e.equipment)) return 1;
  if (/(one|single)[- ]?(arm|hand|leg)|goblet|pullover|svend|tibialis|single dumbbell|one dumbbell|concentration/i.test(e.name)) return 1;
  return e.equipment === 'kettlebell' && !/double|two/i.test(e.name) ? 1 : 2;
}

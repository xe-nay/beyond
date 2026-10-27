// How much of the body's weight a bodyweight exercise moves. A set then counts as that share of the
// lifter's body weight (plus any added load) in its load, volume, estimated 1RM and records.
//
// Where a force-plate study exists, its value is used:
// - push-ups: Wurm, Ebben et al. 2011 (ISBS, 23 adults, force platform): regular 0.64, bent knee 0.49,
//   feet on a 30 / 61 cm box 0.70 / 0.74, hands on a 30 / 61 cm box 0.55 / 0.41; Gouvali & Boudolos 2005
//   (JSCR): regular 0.66, bent knee 0.53; Suprak et al. 2011 (JSCR): 0.69 top / 0.75 bottom, knees
//   0.54 / 0.62. The averages are used.
// Elsewhere the share is worked out from body segment masses (de Leva 1996, J Biomech 29:1223, the
// mean of the male and female tables), each segment weighted by how far it travels compared with the
// part that moves the most: e.g. a squat lifts head, arms and trunk fully (0.59) and the thighs about
// 0.6 of the way (their centre of mass sits 0.4 down from the hip), the shins and feet hardly at all:
// 0.59 + 0.29 × 0.6 = 0.77 (ExRx's figure for the squat is about 0.72).
// Holds, stretches, crawls and jumps are timed or not lifting, so they get none.
import type { Exercise, Session } from './types';

export interface BodyShare {
  share: number;
  basis: string;
}

const PUSHUP = 'Force-plate push-up studies (Ebben 2011, Gouvali 2005, Suprak 2011)';
const SEGMENTS = 'Body segment masses (de Leva 1996) and how far each moves';
const ESTIMATE = 'Estimate from body angle, between the measured push-up and row positions';

// First match wins; patterns are tried against the lower-case name.
const RULES: [RegExp, number, string][] = [
  // Not lifting: timed holds and poses are filtered before; these move without a load to count.
  [/crawl|inchworm|wind sprint|heel-to-toe|downward dog|isometric neck|chin tuck|superman|russian twist|wipers|cocoons|pilates|towel/, 0, ''],
  // Push-ups.
  [/handstand push/, 0.94, SEGMENTS],
  [/pike push/, 0.7, ESTIMATE],
  [/pseudo planche/, 0.75, ESTIMATE],
  [/wall push/, 0.3, ESTIMATE],
  [/knee push/, 0.52, PUSHUP],
  [/incline push/, 0.48, PUSHUP],
  [/decline push|feet elevated/, 0.72, PUSHUP],
  [/trx chest press/, 0.45, 'Suspension push-up strap loads (Gulmez 2017), at a typical lean'],
  [/push.?up|pushup|body-up|body tricep press/, 0.66, PUSHUP],
  // Dips.
  [/bench dip|crab dip|reverse plank dip/, 0.65, ESTIMATE],
  [/dip/, 0.95, SEGMENTS],
  [/step.?up/, 0.89, SEGMENTS],
  [/side plank/, 0.2, SEGMENTS],
  // Hanging from a bar or rings: the whole body but the hands and part of the arms.
  [/hanging (knee|leg)|captain's chair|toes to bar|hanging pike|knee raise|leg raise|leg lift|leg pull-in|leg tucks|reverse crunch|hip raise|bottoms up/, 0.41, SEGMENTS],
  [/pull.?up|chin.?up|pullup|muscle.?up|chin\/crunch/, 0.96, SEGMENTS],
  // Rows and other suspension pulls, body leaning back with the feet on the floor.
  [/inverted row|ring row|trx row/, 0.55, PUSHUP + ', mirrored for the same body angle'],
  [/face pull|y-fly|trx bicep|trx triceps/, 0.4, ESTIMATE],
  [/trx hamstring/, 0.4, SEGMENTS],
  // Legs.
  [/trx (squat|lunge|pistol)/, 0.6, ESTIMATE],
  [/pistol/, 0.89, SEGMENTS],
  [/lunge|split squat/, 0.85, SEGMENTS],
  [/cossack/, 0.8, SEGMENTS],
  [/squat/, 0.77, SEGMENTS],
  [/calf raise/, 0.99, SEGMENTS],
  [/nordic|glute ham/, 0.89, SEGMENTS],
  [/single leg glute bridge/, 0.55, SEGMENTS],
  [/bridge|butt lift|hip pulses|butt-ups/, 0.4, SEGMENTS],
  [/back extension|hyperextension|good morning/, 0.5, SEGMENTS],
  [/fire hydrant|kickback|abduction|adduction|clamshell|side kick/, 0.2, SEGMENTS],
  // Abs.
  [/dragon flag/, 0.68, SEGMENTS],
  [/v ups|v-up|jackknife|side jackknife/, 0.91, SEGMENTS],
  [/flutter|scissor/, 0.21, SEGMENTS],
  [/sit-up|situp|sit up/, 0.5, SEGMENTS],
  [/crunch|heel touch|heel toucher|elbow to knee|side bend/, 0.32, SEGMENTS],
  [/lateral raise|overhead press/, 0.09, SEGMENTS],
];

/** The share of body weight an exercise moves, or null when it is not done with body weight. */
export function bodyShare(e: Exercise | undefined): BodyShare | null {
  if (!e || e.equipment !== 'bodyweight' || e.category !== 'strength' || e.force === 'static') return null;
  const name = e.name.toLowerCase();
  const rule = RULES.find(([re]) => re.test(name));
  if (!rule || !rule[1]) return null;
  return { share: rule[1], basis: rule[2] };
}

/** The body weight on the day of `date` (the last weigh-in on or before it, else the first one after). */
export function bodyWeightOn(entries: { date: string; weightKg: number | null }[], date: string) {
  const known = entries.filter((b) => b.weightKg);
  const before = known.filter((b) => b.date.slice(0, 10) <= date.slice(0, 10));
  return (before.length ? before[before.length - 1] : known[0])?.weightKg ?? null;
}

/** The kilograms of body weight a set of this exercise moves, rounded to 0.1 kg. */
export function bodyKg(e: Exercise | undefined, weightKg: number | null) {
  const b = bodyShare(e);
  return b && weightKg ? Math.round(b.share * weightKg * 10) / 10 : null;
}

/**
 * Sets of bodyweight exercises logged without their body weight (before it was counted, or before a
 * weigh-in existed) get it from the weight on their day. Returns the same array when nothing changed.
 */
export function fillBodyKg(sessions: Session[], entries: { date: string; weightKg: number | null }[], byId: Record<string, Exercise>) {
  if (!entries.some((b) => b.weightKg)) return sessions;
  let changed = false;
  const next = sessions.map((session) => {
    if (!session.sets.some((x) => x.bodyKg === undefined && bodyShare(byId[x.exerciseId]))) return session;
    const sets = session.sets.map((x) => {
      if (x.bodyKg !== undefined) return x;
      const kg = bodyKg(byId[x.exerciseId], bodyWeightOn(entries, x.completedAt));
      return kg === null ? x : { ...x, bodyKg: kg };
    });
    changed = true;
    return { ...session, sets };
  });
  return changed ? next : sessions;
}

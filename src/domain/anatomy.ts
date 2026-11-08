// Which parts of each muscle an exercise works, for the detailed body map: the upper and lower chest,
// the three deltoid heads, the upper, middle and lower traps, lats, biceps against brachialis, the
// quadriceps' rectus femoris against the vasti, gastrocnemius against soleus, and so on.
//
// Three steps, the later ones overriding:
// 1. The exercise's muscle groups (main muscles lead, supporting ones help), narrowed by the detailed
//    muscle names the exercise lists (a "shoulders" exercise naming only the posterior deltoid lights
//    only that head).
// 2. Rules by exercise, from studies where they exist (surface EMG or growth, small samples; EMG is
//    activation, not growth):
//    - Bench inclination: the upper chest works most at about 30°, the middle and lower chest at 0°;
//      past 45° the front delts take over (Rodríguez-Ridao et al. 2020, 30 trained adults). Decline
//      and dips favour the lower chest (earlier studies reviewed there).
//    - Deltoids: overhead presses work the front delts most, lateral raises and presses the side
//      delts; the bench press and flys hardly work the side delts (Campos et al. 2020).
//    - Rectus femoris works fully only when the knee straightens with the hip bent (leg extension),
//      far less in squats and leg presses (Ema et al. 2016).
//    - Standing calf raises (knee straight) grew the gastrocnemius far more than seated ones, the
//      soleus about the same (Kinoshita et al. 2023): seated, the gastrocnemius is slack.
//    - The biceps also turns the palm up, so palms down (reverse curls) leaves more to the brachialis
//      and forearm (anatomy); whether a neutral grip raises the brachioradialis, studies disagree
//      (2023 bodybuilder study found more with palms up).
//    - Overhead triceps work stretches the long head and grew the triceps more than pushdowns
//      (Maeo et al. 2023); the map draws the triceps as one.
//    - Where no study compares variants, rules follow fibre direction or the joint moved, and say so.
// 3. Pulling exercises take the back in detail from backFocus.ts (grip and attachment).
import { backFocus, type Level } from './backFocus.ts';
import type { Exercise, Region } from './types.ts';

export type Part =
  | 'upperChest' | 'lowerChest' | 'frontDelts' | 'sideDelts' | 'rearDelts'
  | 'upperTraps' | 'midTraps' | 'lowerTraps' | 'lats' | 'teres' | 'lowerBack'
  | 'biceps' | 'brachialis' | 'forearmFlexors' | 'forearmExtensors' | 'triceps'
  | 'abs' | 'obliques' | 'serratus'
  | 'glutes' | 'gluteMed' | 'quads' | 'rectusFemoris' | 'hamstrings' | 'adductors' | 'hipFlexors'
  | 'calves' | 'soleus' | 'tibialis' | 'neck';

export const PART_NAMES: Record<Part, string> = {
  upperChest: 'Upper chest', lowerChest: 'Mid & lower chest', frontDelts: 'Front delts', sideDelts: 'Side delts', rearDelts: 'Rear delts',
  upperTraps: 'Upper traps', midTraps: 'Mid traps · rhomboids', lowerTraps: 'Lower traps', lats: 'Lats', teres: 'Teres · rotator cuff', lowerBack: 'Lower back',
  biceps: 'Biceps', brachialis: 'Brachialis', forearmFlexors: 'Forearm · brachioradialis', forearmExtensors: 'Forearm extensors', triceps: 'Triceps',
  abs: 'Abs', obliques: 'Obliques', serratus: 'Serratus',
  glutes: 'Glutes', gluteMed: 'Side glutes · abductors', quads: 'Quads (vasti)', rectusFemoris: 'Rectus femoris', hamstrings: 'Hamstrings', adductors: 'Adductors', hipFlexors: 'Hip flexors',
  calves: 'Gastrocnemius', soleus: 'Soleus', tibialis: 'Shin', neck: 'Neck',
};

export const PART_REGION: Record<Part, Region> = {
  upperChest: 'chest', lowerChest: 'chest', frontDelts: 'deltoids', sideDelts: 'deltoids', rearDelts: 'deltoids',
  upperTraps: 'trapezius', midTraps: 'upper-back', lowerTraps: 'upper-back', lats: 'upper-back', teres: 'upper-back', lowerBack: 'lower-back',
  biceps: 'biceps', brachialis: 'biceps', forearmFlexors: 'forearm', forearmExtensors: 'forearm', triceps: 'triceps',
  abs: 'abs', obliques: 'obliques', serratus: 'abs',
  glutes: 'gluteal', gluteMed: 'gluteal', quads: 'quadriceps', rectusFemoris: 'quadriceps', hamstrings: 'hamstring', adductors: 'adductors', hipFlexors: 'quadriceps',
  calves: 'calves', soleus: 'calves', tibialis: 'tibialis', neck: 'neck',
};

/** Parts a muscle group lights when the exercise names nothing more precise. */
const REGION_PARTS: Record<Region, Part[]> = {
  chest: ['upperChest', 'lowerChest'], deltoids: ['frontDelts', 'sideDelts'], biceps: ['biceps', 'brachialis'], triceps: ['triceps'],
  forearm: ['forearmFlexors'], abs: ['abs'], obliques: ['obliques'], trapezius: ['upperTraps'], 'upper-back': ['lats', 'midTraps'],
  'lower-back': ['lowerBack'], gluteal: ['glutes'], quadriceps: ['quads', 'rectusFemoris'], hamstring: ['hamstrings'],
  adductors: ['adductors'], calves: ['calves', 'soleus'], tibialis: ['tibialis'], neck: ['neck'],
};

/** Detailed muscle names in the catalog and the part each one is. */
const NAMED: Record<string, Part> = {
  'anterior deltoid': 'frontDelts', 'lateral deltoid': 'sideDelts', 'posterior deltoid': 'rearDelts',
  'latissimus dorsi': 'lats', lats: 'lats', rhomboids: 'midTraps', 'middle back': 'midTraps',
  'infraspinatus teres minor': 'teres', supraspinatus: 'teres', 'erector spinae': 'lowerBack', 'quadratus lumborum': 'lowerBack',
  'biceps brachii': 'biceps', brachialis: 'brachialis', brachioradialis: 'forearmFlexors', 'forearm flexors': 'forearmFlexors', 'forearm extensors': 'forearmExtensors',
  'serratus anterior': 'serratus', 'rectus abdominis': 'abs', 'gluteus maximus': 'glutes', 'gluteus medius': 'gluteMed', abductors: 'gluteMed',
  'hip flexors': 'hipFlexors', gastrocnemius: 'calves', soleus: 'soleus', 'tibialis anterior': 'tibialis',
};

export interface Anatomy { parts: [Part, Level][]; note: string | null; source: string | null }
type Rule = { parts: [Part, Level][]; note?: string; source?: string };

function rule(e: Exercise): Rule | null {
  const n = e.name.toLowerCase();
  const has = (r: RegExp) => r.test(n);
  const chestish = e.primary.includes('chest') || has(/bench press|chest press|push[- ]?up|fly|flye|pec deck|crossover|\bdips?\b/);

  // Chest: inclination decides the upper against the mid and lower chest.
  if (chestish && !e.primary.includes('triceps') && !has(/tricep|reverse fly|rear/)) {
    const press = has(/press|push[- ]?up/);
    const fly = has(/fly|flye|pec deck|crossover/);
    const steep = has(/60|high incline|steep/);
    if (has(/incline/) && !has(/decline/)) {
      return steep
        ? { parts: [['frontDelts', 3], ['upperChest', 2], ['triceps', 2], ['lowerChest', 1]], note: 'Steeper than about 45°, the front delts take over from the chest.', source: 'Rodríguez-Ridao et al. 2020' }
        : { parts: [['upperChest', 3], ['lowerChest', 2], ['frontDelts', 2], ...(press ? [['triceps', 2]] as [Part, Level][] : [])], note: 'An incline of about 30° works the upper chest most; past 45° the front delts take over.', source: 'Rodríguez-Ridao et al. 2020 (5 inclinations, 30 trained adults)' };
    }
    if (has(/decline|\bdips?\b/)) {
      return { parts: [['lowerChest', 3], ['triceps', has(/dip/) ? 3 : 2], ['frontDelts', 2], ['upperChest', 1]], note: 'Decline and dips favour the lower chest.', source: 'Earlier studies reviewed by Rodríguez-Ridao et al. 2020' };
    }
    if (fly) {
      if (has(/low[- ]to[- ]high/)) return { parts: [['upperChest', 3], ['lowerChest', 2], ['frontDelts', 2]], note: 'Arms rising from low to high follow the upper chest’s fibres.', source: 'Fibre direction (anatomy), not measured' };
      if (has(/high[- ]to[- ]low/)) return { parts: [['lowerChest', 3], ['upperChest', 1], ['frontDelts', 1]], note: 'Arms coming down from high to low follow the lower chest’s fibres.', source: 'Fibre direction (anatomy), not measured' };
      return { parts: [['lowerChest', 3], ['upperChest', 2], ['frontDelts', 1]], note: 'Flys work the chest with little help from the side delts or the triceps.', source: 'Campos et al. 2020' };
    }
    if (press) {
      return { parts: [['lowerChest', 3], ['upperChest', 2], ['frontDelts', 2], ['triceps', 2]], note: 'Flat, the middle and lower chest work most; an incline of about 30° shifts the work up.', source: 'Rodríguez-Ridao et al. 2020' };
    }
  }

  // Shoulders.
  if (has(/upright row/)) return { parts: [['sideDelts', 3], ['upperTraps', 3], ['frontDelts', 1], ['biceps', 1]], note: 'Elbows lead up and out: side delts and upper traps.', source: 'Joint movement (anatomy)' };
  if (has(/rear[- ]delt|reverse fly|reverse flye|reverse pec|face pull/)) return { parts: [['rearDelts', 3], ['midTraps', 2], ['teres', 2], ['lowerTraps', 1]], note: 'Arms pulled back and out, elbows high: rear delts with the mid back and the rotator cuff.', source: 'Joint movement (anatomy)' };
  if (has(/lateral raise|side raise|lateral delt|y[- ]raise/)) return { parts: [['sideDelts', 3], ['frontDelts', 1], ['rearDelts', 1], ['upperTraps', 1]], note: 'Raising to the side works the side delts most of the shoulder exercises.', source: 'Campos et al. 2020' };
  if (has(/front raise/)) return { parts: [['frontDelts', 3], ['upperChest', 1], ['sideDelts', 1]], note: 'Raising to the front: the front delts, with the upper chest.', source: 'Joint movement (anatomy)' };
  if (has(/shrug/)) return { parts: [['upperTraps', 3], ['forearmFlexors', 1]], note: 'Lifting the shoulders: the upper traps.', source: 'Joint movement (anatomy)' };
  if (has(/(shoulder|overhead|military|arnold|push|seated|standing|dumbbell|machine|landmine|z) press/) && !has(/bench|chest|leg|incline|decline|floor/) && (e.primary.includes('deltoids') || has(/shoulder|overhead|military|arnold/))) {
    return { parts: [['frontDelts', 3], ['sideDelts', 2], ['triceps', 2], ['upperTraps', 1], ['upperChest', 1]], note: 'Pressing overhead works the front delts most, the side delts a good deal.', source: 'Campos et al. 2020' };
  }

  // Arms.
  if (has(/wrist curl|wrist flexion/)) return has(/reverse/) ? { parts: [['forearmExtensors', 3]] } : { parts: [['forearmFlexors', 3]] };
  if (has(/curl/) && !has(/leg curl|hamstring|nordic|wrist|ham curl/) && (e.primary.includes('biceps') || has(/bicep|hammer|preacher|concentration|spider|drag/))) {
    if (has(/reverse|pronated|overhand/)) return { parts: [['brachialis', 3], ['forearmFlexors', 2], ['forearmExtensors', 2], ['biceps', 2]], note: 'Palms down puts the biceps at a disadvantage (it also turns the palm up): the brachialis and the forearm take more.', source: 'Biceps anatomy; 2023 handgrip study' };
    if (has(/hammer|neutral|cross[- ]body/)) return { parts: [['biceps', 3], ['brachialis', 2], ['forearmFlexors', 2]], note: 'Thumbs up: the brachioradialis works throughout, though studies disagree on whether more than palms up.', source: '2023 handgrip study in bodybuilders' };
    return { parts: [['biceps', 3], ['brachialis', 2], ['forearmFlexors', 1]], note: 'Palms up: the biceps lead, the brachialis works under them.', source: 'Biceps anatomy; 2023 handgrip study' };
  }
  if (e.primary.includes('triceps') && !has(/dip|bench press|close[- ]grip/)) {
    if (has(/overhead|french|over[- ]head|behind/)) return { parts: [['triceps', 3], ['lats', 1]], note: 'Arms overhead stretch the long head; overhead work grew the triceps more than pushdowns.', source: 'Maeo et al. 2023' };
    return { parts: [['triceps', 3]], note: 'Elbows straightening: the triceps. Overhead versions also stretch its long head.', source: 'Maeo et al. 2023' };
  }

  // Legs.
  if (has(/calf|heel raise|calves/)) {
    return has(/seated|bent[- ]knee|soleus/)
      ? { parts: [['soleus', 3], ['calves', 1]], note: 'Knee bent: the gastrocnemius is slack, so the soleus does the work.', source: 'Kinoshita et al. 2023' }
      : { parts: [['calves', 3], ['soleus', 2]], note: 'Knee straight: both calf muscles work; standing raises grew the gastrocnemius far more than seated ones.', source: 'Kinoshita et al. 2023' };
  }
  if (has(/tibialis|toe raise|dorsiflex/)) return { parts: [['tibialis', 3]] };
  if (has(/leg extension|knee extension|sissy/)) return { parts: [['quads', 3], ['rectusFemoris', 3]], note: 'Straightening the knee with the hip bent is where the rectus femoris works fully; squats and presses use it far less.', source: 'Ema et al. 2016' };
  if (has(/leg curl|hamstring curl|nordic|glute[- ]ham/)) return { parts: [['hamstrings', 3], ['calves', 1]], note: 'Bending the knee: the hamstrings, with a little help from the calves.', source: 'Joint movement (anatomy)' };
  if (has(/romanian|\brdl\b|stiff[- ]leg|good morning|straight[- ]leg deadlift/)) return { parts: [['hamstrings', 3], ['glutes', 3], ['lowerBack', 2], ['adductors', 1], ['forearmFlexors', 1]], note: 'Hips back, knees nearly straight: hamstrings and glutes stretch and work most.', source: 'Joint movement (anatomy)' };
  if (has(/deadlift|rack pull/) && !has(/romanian|stiff|single[- ]leg/)) return { parts: [['glutes', 3], ['lowerBack', 3], ['hamstrings', 2], ['quads', 2], ['upperTraps', 2], ['forearmFlexors', 2], ['lats', 1], ['adductors', 1]], note: 'Hips and knees extend together; the back holds the bar close and straight.', source: 'Joint movement (anatomy)' };
  if (has(/hip thrust|glute bridge|bridge/)) return { parts: [['glutes', 3], ['hamstrings', 1], ['quads', 1]], note: 'The hips extend with the knees bent: the glutes do most of the work.', source: 'Joint movement (anatomy)' };
  if (has(/abduct|clamshell|lateral walk|monster walk/)) return { parts: [['gluteMed', 3], ['glutes', 1]] };
  if (has(/adduct|copenhagen/)) return { parts: [['adductors', 3]] };
  if (has(/lunge|split squat|bulgarian|step[- ]up/)) return { parts: [['quads', 3], ['glutes', 3], ['gluteMed', 2], ['adductors', 2], ['rectusFemoris', 1]], note: 'One leg at a time: quads and glutes, with the side glutes keeping the hips level.', source: 'Joint movement (anatomy)' };
  if (has(/leg press|hack squat/)) return { parts: [['quads', 3], ['glutes', 2], ['adductors', 2], ['rectusFemoris', 1]], note: 'The vasti do most of the work; the rectus femoris far less than in a leg extension.', source: 'Ema et al. 2016' };
  if (has(/squat/)) return { parts: [['quads', 3], ['glutes', 3], ['adductors', 2], ['lowerBack', has(/front|goblet/) ? 1 : 2], ['rectusFemoris', 1], ['soleus', 1]], note: 'The vasti and glutes drive it; the rectus femoris works far less than in a leg extension.', source: 'Ema et al. 2016' };

  // Core.
  if (has(/twist|woodchop|wood chop|side bend|pallof|oblique|side plank|bicycle|russian/)) return { parts: [['obliques', 3], ['abs', 1]] };
  if (has(/leg raise|knee raise|toes to bar/)) return { parts: [['abs', 3], ['hipFlexors', 2], ['obliques', 1]], note: 'Lifting the legs: the hip flexors move them, the abs curl the pelvis up.', source: 'Joint movement (anatomy)' };
  if (has(/crunch|sit[- ]?up|ab wheel|rollout|plank|hollow/)) return { parts: [['abs', 3], ['obliques', 1]] };
  return null;
}

export function anatomy(e: Exercise | undefined, attachment?: string): Anatomy | null {
  if (!e) return null;
  // 1. Muscle groups, narrowed by the named muscles.
  const named = new Set(e.muscles.map((m) => NAMED[m.toLowerCase()]).filter((p): p is Part => !!p));
  const levels = new Map<Part, Level>();
  const put = (p: Part, l: Level) => levels.set(p, Math.max(levels.get(p) ?? 0, l) as Level);
  const group = (r: Region, l: Level) => {
    const precise = [...named].filter((p) => PART_REGION[p] === r);
    (precise.length ? precise : REGION_PARTS[r]).forEach((p) => put(p, l));
  };
  e.primary.forEach((r) => group(r, 3));
  e.secondary.filter((r) => !e.primary.includes(r)).forEach((r) => group(r, 1));
  let note: string | null = null;
  let source: string | null = null;

  // 2. The exercise's own rule: its parts as given, everything else it lists at most "helps".
  // 3. Pulls take the back in detail first (grip and attachment).
  const back = e.category === 'strength' ? backFocus(e, attachment) : null;
  const r = back ?? (e.category === 'strength' ? rule(e) : null);
  if (r) {
    const set = new Set(r.parts.map(([p]) => p));
    for (const [p, l] of [...levels]) if (!set.has(p)) levels.set(p, Math.min(l, 1) as Level);
    r.parts.forEach(([p, l]) => levels.set(p, l));
    note = r.note ?? null;
    source = r.source ?? null;
  }
  const parts = [...levels].filter(([, l]) => l > 0).sort((a, b) => b[1] - a[1]);
  return parts.length ? { parts, note, source } : null;
}

// Builds the exercise catalog the app ships with, from two open datasets:
//  - RepDB free tier (repdb.co): flat illustrations, used in-app with attribution. Its terms forbid
//    republishing the dataset, so the merged file is generated at build time and never committed.
//  - free-exercise-db (Unlicense): fills in every exercise RepDB does not have, with photos.
// Usage: node scripts/build-exercises.mjs   (writes src/data/exercises.json)
import { mkdirSync, writeFileSync } from 'node:fs';

const REPDB = 'https://exercise-dataset.com';
const FEDB = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main';

// Muscle names from both datasets, mapped onto the regions the body map can highlight.
const REGION = {
  gluteus_maximus: 'gluteal', gluteus_medius: 'gluteal', abductors: 'gluteal', glutes: 'gluteal',
  hamstrings: 'hamstring',
  anterior_deltoid: 'deltoids', lateral_deltoid: 'deltoids', posterior_deltoid: 'deltoids',
  supraspinatus: 'deltoids', shoulders: 'deltoids',
  quadriceps: 'quadriceps', hip_flexors: 'quadriceps',
  triceps_brachii: 'triceps', triceps: 'triceps',
  erector_spinae: 'lower-back', quadratus_lumborum: 'lower-back', 'lower back': 'lower-back',
  trapezius: 'trapezius', traps: 'trapezius',
  rectus_abdominis: 'abs', transverse_abdominis: 'abs', abdominals: 'abs',
  pectoralis_major: 'chest', chest: 'chest',
  biceps_brachii: 'biceps', brachialis: 'biceps', biceps: 'biceps',
  latissimus_dorsi: 'upper-back', rhomboids: 'upper-back', lats: 'upper-back', 'middle back': 'upper-back',
  obliques: 'obliques', serratus_anterior: 'obliques',
  forearm_flexors: 'forearm', forearm_extensors: 'forearm', brachioradialis: 'forearm', forearms: 'forearm',
  gastrocnemius: 'calves', soleus: 'calves', calves: 'calves',
  adductors: 'adductors', tibialis_anterior: 'tibialis', neck: 'neck',
};

const EQUIPMENT = {
  barbell: 'barbell', ez_bar: 'ez-bar', 'e-z curl bar': 'ez-bar', smith_machine: 'smith', trap_bar: 'trap-bar',
  dumbbell: 'dumbbell', kettlebell: 'kettlebell', kettlebells: 'kettlebell', cable: 'cable',
  loop_band: 'band', resistance_band: 'band', bands: 'band', plates: 'plate',
  'body only': 'bodyweight', pull_up_bar: 'bodyweight', dip_station: 'bodyweight', rings: 'bodyweight',
  suspension_trainer: 'bodyweight', flat_bench: 'bodyweight', plyo_box: 'bodyweight', ab_wheel: 'other',
  stability_ball: 'ball', 'exercise ball': 'ball', 'medicine ball': 'ball', 'foam roll': 'other',
  machine: 'machine', other: 'other',
};
const machine = (e) => /machine|press$|curl$|extension$|hack_squat|sled|treadmill|bike|elliptical|bicycle|rope/.test(e);

function equipmentOf(raw, bodyweight) {
  if (!raw) return bodyweight ? 'bodyweight' : 'other';
  return EQUIPMENT[raw] ?? (machine(raw) ? 'machine' : 'other');
}

const regions = (list) => [...new Set((list ?? []).map((m) => REGION[m]).filter(Boolean))];
const key = (name) =>
  name.toLowerCase().replace(/\bdb\b/g, 'dumbbell').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)
    .filter(Boolean).map((w) => w.replace(/s$/, '')).sort().join(' ');
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const CATEGORY = { 'olympic weightlifting': 'olympic', powerlifting: 'strength', strongman: 'strength' };

async function json(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

const repdb = (await json(`${REPDB}/exercises.json`)).exercises;
const fedb = await json(`${FEDB}/dist/exercises.json`);

const out = [];
const seen = new Set();

for (const e of repdb) {
  const flat = e.images?.flat ?? {};
  const images = [flat.start, flat.peak, flat.main].filter(Boolean).map((p) => `${REPDB}/${p}`);
  const equipment = equipmentOf(e.equipment, e.is_bodyweight);
  out.push({
    id: e.id,
    name: e.name_en,
    src: 'r',
    category: e.category,
    equipment,
    primary: regions(e.primary_muscles),
    secondary: regions(e.secondary_muscles).filter((m) => !regions(e.primary_muscles).includes(m)),
    muscles: [...(e.primary_muscles ?? []), ...(e.secondary_muscles ?? [])].map((m) => m.replace(/_/g, ' ')),
    level: e.difficulty ?? 'intermediate',
    mechanic: e.mechanic ?? null,
    force: e.force_type ?? null,
    unilateral: !!e.is_unilateral,
    group: e.variation_group ?? null,
    description: e.description_en ?? '',
    steps: e.instructions_en ?? [],
    tips: e.tips_en ?? [],
    met: e.met ?? null,
    images,
  });
  seen.add(key(e.name_en));
}

for (const e of fedb) {
  if (seen.has(key(e.name))) continue;
  seen.add(key(e.name));
  out.push({
    id: `f-${slug(e.id)}`,
    name: e.name,
    src: 'f',
    category: CATEGORY[e.category] ?? e.category,
    equipment: equipmentOf(e.equipment, false),
    primary: regions(e.primaryMuscles),
    secondary: regions(e.secondaryMuscles).filter((m) => !regions(e.primaryMuscles).includes(m)),
    muscles: [...e.primaryMuscles, ...e.secondaryMuscles],
    level: e.level === 'expert' ? 'advanced' : e.level,
    mechanic: e.mechanic,
    force: e.force,
    unilateral: /single|one[- ]arm|one[- ]leg|alternat/i.test(e.name),
    group: null,
    description: '',
    steps: e.instructions,
    tips: [],
    met: null,
    images: e.images.map((p) => `${FEDB}/exercises/${p}`),
  });
}

out.sort((a, b) => a.name.localeCompare(b.name));
mkdirSync('src/data', { recursive: true });
writeFileSync('src/data/exercises.json', JSON.stringify(out));
const by = (k) => Object.entries(out.reduce((m, e) => ((m[e[k]] = (m[e[k]] ?? 0) + 1), m), {}));
console.log(`${out.length} exercises (${out.filter((e) => e.src === 'r').length} RepDB)`);
console.log('equipment', by('equipment'));

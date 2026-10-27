import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadBarbell, toKg, toDisplay } from './plates.ts';
import { e1rm, rirToRpe, repDrop, progression, fatigueReport, personalRecords } from './calc.ts';
import { timeline, position, beepFor, elapsed, pause, resume, skip, totalSeconds } from './intervals.ts';
import { fromOff, scale, startingTargets } from './nutrition.ts';
import { parseTrainingFile } from './importer.ts';
import type { CardioSession, Exercise, Session, WorkoutSet, Prescription, IntervalPlan } from './types.ts';

const set = (reps: number, loadKg: number, rir: number | null = 2, extra: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: Math.random().toString(36), exerciseId: 'bench-press', reps, loadKg, rir, warmup: false, completedAt: '2026-10-01T10:00:00Z', restSeconds: null, ...extra,
});
const session = (date: string, sets: WorkoutSet[], extra: Partial<Session> = {}): Session => ({
  id: date, programId: null, dayId: null, name: 'S', date, plan: [], sets, startedAt: `${date}T10:00:00Z`, finishedAt: `${date}T11:00:00Z`, sessionRpe: 7, notes: '', ...extra,
});

test('barbell loads 100 kg as 25+15 per side on a 20 kg bar', () => {
  const l = loadBarbell(100, 'kg');
  assert.deepEqual(l.perSide.map((p) => p.weight), [25, 15]);
  assert.equal(l.loaded, 100);
  assert.equal(l.missing, 0);
});

test('barbell in pounds uses 45s and reports what cannot be loaded', () => {
  const l = loadBarbell(226, 'lb');
  assert.deepEqual(l.perSide.map((p) => p.weight), [45, 45]);
  assert.equal(l.loaded, 225);
  assert.equal(l.missing, 1);
});

test('unit conversion round-trips', () => {
  assert.ok(Math.abs(toKg(toDisplay(80, 'lb'), 'lb') - 80) < 1e-9);
});

test('e1rm and RPE', () => {
  assert.equal(e1rm(100, 1), 100);
  assert.ok(Math.abs(e1rm(100, 5)! - 116.67) < 0.01);
  assert.equal(e1rm(100, 15), null);
  assert.equal(rirToRpe(2), 8);
  assert.equal(rirToRpe(6), null);
});

test('rep drop across sets at the same load', () => {
  assert.deepEqual(repDrop([set(10, 60), set(8, 60), set(6, 60)]), { first: 10, last: 6, percent: -40 });
  assert.equal(repDrop([set(10, 60), set(8, 65)]), null);
});

test('double progression asks for load after two sessions at the top of the range', () => {
  const p: Prescription = { exerciseId: 'bench-press', sets: 3, minReps: 8, maxReps: 12, rir: 2, restSeconds: 120, loadKg: null };
  const top = () => [set(12, 60), set(12, 60), set(12, 60)];
  const history = [session('2026-10-01', top()), session('2026-10-04', top())];
  const a = progression(history, p);
  assert.equal(a.kind, 'increase');
  assert.equal(a.nextKg, 62.5);
  assert.equal(progression([session('2026-10-01', [set(10, 60), set(9, 60), set(8, 60)])], p).kind, 'reps');
  assert.equal(progression([], p).kind, 'start');
});

test('fatigue flags many near-failure sets', () => {
  const now = Date.parse('2026-10-10T12:00:00Z');
  const hard = Array.from({ length: 8 }, () => set(8, 60, 0));
  const r = fatigueReport([session('2026-10-09', hard)], [], now);
  assert.ok(r.signals.some((s) => s.label === 'Many sets near failure'));
  assert.equal(fatigueReport([], [], now).status, 'Not enough data');
});

test('personal record detected against earlier sessions', () => {
  const a = session('2026-10-01', [set(5, 100)]);
  const b = session('2026-10-05', [set(5, 105)]);
  assert.equal(personalRecords([a, b], b).length, 1);
});

const plan: IntervalPlan = { activity: 'Running', warmupSeconds: 60, workSeconds: 30, recoverySeconds: 60, rounds: 3, cooldownSeconds: 60, workCue: '4:30/km', recoveryCue: 'walk', countdown: 5 };

test('interval timeline has no recovery after the last round', () => {
  const t = timeline(plan);
  assert.deepEqual(t.map((p) => p.kind), ['warmup', 'work', 'recovery', 'work', 'recovery', 'work', 'cooldown']);
  assert.equal(totalSeconds(plan), 60 + 90 + 120 + 60);
  assert.equal(position(t, 65).phase!.kind, 'work');
});

test('countdown beeps 5..1 then the end tone', () => {
  assert.deepEqual([6, 5, 4.2, 1, 0.5, 0].map((s) => beepFor(s, 5)), [null, 'tick', 'tick', 'tick', 'tick', 'end']);
  assert.equal(beepFor(3, 0), null);
});

test('clock pauses, resumes and skips', () => {
  let c = resume({ banked: 0, resumedAt: null }, 0);
  c = pause(c, 10_000);
  assert.equal(elapsed(c, 50_000), 10);
  c = resume(c, 50_000);
  assert.equal(elapsed(c, 55_000), 15);
  c = skip(c, timeline(plan), 55_000);
  assert.equal(elapsed(c, 55_000), 60);
});

test('Open Food Facts product normalisation and portions', () => {
  const f = fromOff({ code: '3017620422003', product_name: 'Nutella', brands: 'Ferrero', nutriments: { 'energy-kcal_100g': 539, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9 }, nutriscore_grade: 'e', product_quantity_unit: 'g' })!;
  assert.equal(f.per100.kcal, 539);
  assert.equal(f.brand, 'Ferrero');
  assert.deepEqual(scale(f.per100, 15).kcal, 81);
  assert.equal(fromOff({ product_name: 'X', nutriments: {} }), null);
});

test('starting targets require explicit inputs', () => {
  const base = { name: '', unit: 'kg' as const, goal: 'hypertrophy' as const, experience: 'intermediate' as const, days: 4, minutes: 60, equipment: [], onboarded: true };
  assert.equal(startingTargets({ ...base, sex: null, birthYear: null, heightCm: null }, 80), null);
  const t = startingTargets({ ...base, sex: 'male', birthYear: 1995, heightCm: 180 }, 80)!;
  assert.ok(t.kcal > 2400 && t.kcal < 3400, String(t.kcal));
  assert.equal(t.protein, 144);
});

test('training file: plans and history by date, with unknown exercises rejected', () => {
  const all = [{ id: 'db-bench-press', name: 'DB Bench Press' }, { id: 'f-dumbbell-bench-press', name: 'Dumbbell Bench Press' }] as Exercise[];
  const file = {
    format: 'kinetic-training', version: 1, id: 'w', name: 'Week',
    entries: [
      { id: 'a', date: '2026-10-22', name: 'Past', type: 'strength', exercises: [{ exerciseId: 'Dumbbell_Bench_Press', sets: 2 }], performed: { sets: [{ exerciseId: 'Dumbbell_Bench_Press', reps: 10, loadKg: 20, rir: 2 }] } },
      { id: 'b', date: '2099-10-26', name: 'Next', type: 'strength', exercises: [{ exerciseId: 'db-bench-press', sets: 3 }] },
      { id: 'c', date: '2099-10-27', name: 'Run', type: 'cardio', intervals: { activityType: 'Running', workSeconds: 60, recoverySeconds: 90, rounds: 5, countdownSeconds: 10 } },
    ],
  };
  const r = parseTrainingFile(JSON.stringify(file), all, { sessions: [], cardio: [] });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.rows.map((x) => x.kind), ['history', 'plan', 'plan']);
  assert.equal(r.sessions[0].sets[0].exerciseId, 'f-dumbbell-bench-press');
  assert.equal(r.cardio[0].plan!.countdown, 10);
  const bad = parseTrainingFile(JSON.stringify({ ...file, entries: [{ id: 'x', date: '2026-10-01', type: 'strength', exercises: [{ exerciseId: 'nope' }] }] }), all, { sessions: [], cardio: [] });
  assert.equal(bad.errors.length, 1);
});

test('two dumbbells count double in volume and e1RM', async () => {
  const { volumeLoad, totalLoad, strengthTrend } = await import('./calc.ts');
  const pair = set(10, 20, 2, { implements: 2 });
  assert.equal(totalLoad(pair), 40);
  assert.equal(volumeLoad([pair]), 400);
  assert.equal(volumeLoad([set(10, 20)]), 200);
  const t = strengthTrend([session('2026-10-01', [pair])], 'bench-press');
  assert.ok(Math.abs(t[0].value - 40 * (1 + 10 / 30)) < 1e-9);
});

test('imports never delete other data and ask about days that already have logs', async () => {
  const { applyChoices, needsChoice } = await import('./importer.ts');
  const all = [{ id: 'bench-press', name: 'Barbell Bench Press' }, { id: 'squat', name: 'Barbell Back Squat' }] as Exercise[];
  const mine = session('2026-09-14', [set(8, 80)], { id: 'mine-1', name: 'My push day' });
  const other = session('2026-09-20', [set(5, 100)], { id: 'mine-2' });
  const text = '```json\n' + JSON.stringify({
    format: 'beyond-training', version: 1, id: 'history',
    entries: [
      { id: 'a', date: '2026-09-14', type: 'strength', name: 'Push', performed: { sets: [{ name: 'Bench Press', reps: 6, loadKg: 85 }] } },
      { id: 'b', date: '2026-09-15', type: 'strength', name: 'Legs', performed: { sets: [{ name: 'squat', reps: 5, loadKg: 100 }] } },
    ],
  }) + '\n```';
  const r = parseTrainingFile(text, all, { sessions: [mine, other], cardio: [] });
  assert.deepEqual(r.errors, []);
  assert.equal(r.sessions[0].sets[0].exerciseId, 'bench-press');
  assert.deepEqual(r.rows.map(needsChoice), [true, false]);
  assert.equal(r.rows[0].clashes[0].id, 'mine-1');
  // Default keeps mine: only the clash-free day comes in, nothing is removed.
  const keep = applyChoices(r, {});
  assert.deepEqual(keep.sessions.map((x) => x.id), ['imp-history-b']);
  assert.deepEqual(keep.remove, []);
  const take = applyChoices(r, { 'imp-history-a': 'import' });
  assert.deepEqual(take.remove, ['mine-1']);
  const both = applyChoices(r, { 'imp-history-a': 'both' });
  assert.equal(both.sessions.length, 2);
  assert.deepEqual(both.remove, []);
});

test('GPS distance ignores jitter and jumps; pace and target parsing', async () => {
  const { step, haversine, rollingPace, targetPace, onPace, formatPace } = await import('./track.ts');
  const at = (m: number, s: number, accuracy = 5) => ({ lat: 48.85 + m / 111195, lon: 2.35, t: s * 1000, accuracy });
  assert.ok(Math.abs(haversine(at(0, 0), at(1000, 0)) - 1000) < 1);
  // 1 km in 5 min of good fixes every 10 s
  let anchor = null as Parameters<typeof step>[0], meters = 0;
  const samples: { t: number; m: number }[] = [];
  for (let s = 0; s <= 300; s += 10) {
    const r = step(anchor, at((s / 300) * 1000, s), 'Running')!;
    anchor = r.anchor; meters += r.add; samples.push({ t: s * 1000, m: meters });
  }
  assert.ok(Math.abs(meters - 1000) < 1);
  assert.equal(step(anchor, at(1001, 301), 'Running')!.add, 0); // 1 m of jitter
  assert.equal(step(anchor, at(1500, 302), 'Running'), null); // 500 m in a second
  assert.equal(step(anchor, at(1010, 305, 80), 'Running'), null); // imprecise fix
  assert.ok(Math.abs(rollingPace(samples, 300000)! - 300) < 1);
  assert.equal(targetPace('4:30 /km'), 270);
  assert.ok(Math.abs(targetPace('8:03/mi')! - 300.1) < 0.5);
  assert.equal(targetPace('Easy jog'), null);
  assert.ok(onPace(275, 270) && !onPace(290, 270));
  assert.equal(formatPace(299.6), '5:00');
});

test('import rules: type, empty workouts, ranges, cardio minutes and dumbbell count', () => {
  const all = [{ id: 'db-press', name: 'Dumbbell Shoulder Press', equipment: 'dumbbell' }, { id: 'goblet', name: 'Goblet Squat', equipment: 'dumbbell' }] as Exercise[];
  const file = (entries: unknown[]) => JSON.stringify({ format: 'beyond-training', version: 1, id: 'r', entries });
  const none = { sessions: [], cardio: [] };
  assert.match(parseTrainingFile(file([{ id: 'a', date: '2026-01-05', type: 'yoga' }]), all, none).errors[0], /type must be/);
  assert.match(parseTrainingFile(file([{ id: 'a', date: '2026-01-05' }]), all, none).errors[0], /needs "exercises"/);
  const r = parseTrainingFile(file([
    { id: 'a', date: '2099-01-05', exercises: [{ name: 'Dumbbell Shoulder Press', sets: 40, minReps: 12, maxReps: 6, rir: 9, warmupSets: 9 }] },
    { id: 'b', date: '2026-01-06', performed: { sets: [{ name: 'Dumbbell Shoulder Press', reps: 8, loadKg: 20 }, { name: 'Goblet Squat', reps: 10, loadKg: 24 }] } },
    { id: 'c', date: '2026-01-07', type: 'cardio', intervals: { workSeconds: 1800 }, performed: { distanceKm: 5 } },
  ]), all, none);
  assert.deepEqual(r.errors, []);
  const p = r.sessions[0].plan[0];
  assert.deepEqual([p.sets, p.minReps, p.maxReps, p.rir, p.warmupSets], [10, 12, 12, 5, 5]);
  assert.deepEqual(r.sessions[1].sets.map((s) => s.implements), [2, 1]);
  assert.equal(r.cardio[0].minutes, 30);
});

test('supplements: label values, dose maths and reminders skip ticked days', async () => {
  const { supplementFromOff, doseNutrients, doseMicros, formatDose, reminderPlan } = await import('./supplements.ts');
  const p = supplementFromOff({ code: '123', product_name: 'Multi', brands: 'Acme', nutriments: { 'vitamin-c_serving': 0.08, 'vitamin-c_unit': 'mg', 'vitamin-d_100g': 0.0005 }, serving_quantity: 1 })!;
  const multi = { ...p, id: 'm', dose: 1, unit: 'tablet' as const, time: '08:00', createdAt: '2026-01-01T00:00:00Z' };
  assert.equal(formatDose(multi), '1 tablet');
  assert.deepEqual(doseMicros(multi), [{ key: 'vitaminC', label: 'Vitamin C', amount: 80, unit: 'mg' }, { key: 'vitaminD', label: 'Vitamin D', amount: 5, unit: 'µg' }]);
  assert.deepEqual(doseNutrients(multi)?.micro, { vitaminC: 80, vitaminD: 5 }); // vitamins count even with no energy
  const creatine = { ...multi, id: 'c', name: 'Creatine Monohydrate', unit: 'g' as const, dose: 3, per100: null, serving: undefined, micros: [] };
  assert.deepEqual(doseNutrients(creatine)?.micro, { creatine: 3 }); // a creatine powder counts its own grams
  const whey = { ...multi, id: 'w', name: 'Whey', unit: 'g' as const, dose: 30, per100: { kcal: 400, protein: 80, carbs: 6, fat: 6 }, micros: [], serving: undefined, time: '08:00' };
  assert.deepEqual(doseNutrients(whey), { kcal: 120, protein: 24, carbs: 1.8, fat: 1.8 });
  const now = new Date(2026, 0, 10, 9, 0);
  const plan = reminderPlan([multi, whey], [], now, 3);
  assert.equal(plan.length, 2); // today's 08:00 has passed; the next two mornings remain
  assert.match(plan[0].body, /Multi · 1 tablet\nWhey · 30 g/);
  const ticked = [{ id: 'i', date: '2026-01-11', supplementId: 'm', name: 'Multi', dose: '1 tablet', takenAt: '', nutrients: null }];
  assert.doesNotMatch(reminderPlan([multi, whey], ticked, now, 3)[0].body, /Multi/);
});

test('records: first time, heavier, more reps above 10, nothing when matched', () => {
  const s1 = session('2026-10-21', [set(12, 35, 4, { exerciseId: 'leg-press' }), set(12, 45, 4, { exerciseId: 'leg-press' })]);
  assert.deepEqual(personalRecords([s1], s1).map((p) => p.kind), ['first']);
  const heavier = session('2026-10-25', [set(12, 50, 4, { exerciseId: 'leg-press' })]);
  assert.deepEqual(personalRecords([s1, heavier], heavier).map((p) => [p.kind, p.value]), [['weight', 50]]);
  const moreReps = session('2026-10-25', [set(15, 45, 3, { exerciseId: 'leg-press' })]);
  assert.deepEqual(personalRecords([s1, moreReps], moreReps).map((p) => p.kind), ['e1rm']);
  const same = session('2026-10-25', [set(12, 45, 4, { exerciseId: 'leg-press' })]);
  assert.equal(personalRecords([s1, same], same).length, 0);
});

test('USDA branded food: macros, salt from sodium, vitamins as micronutrients', async () => {
  const { fromFdc } = await import('./fdc.ts');
  const f = fromFdc({
    fdcId: 1, description: 'MULTIVITAMIN DRINK', brandOwner: 'Acme', gtinUpc: '0820213063520', dataType: 'Branded', servingSize: 250, servingSizeUnit: 'ml',
    foodNutrients: [
      { nutrientId: 1008, value: 40 }, { nutrientId: 1003, value: 0 }, { nutrientId: 1005, value: 10 }, { nutrientId: 1004, value: 0 },
      { nutrientId: 1093, value: 20 }, { nutrientId: 1162, value: 24 }, { nutrientId: 1114, value: 1 },
    ],
  })!;
  assert.equal(f.name, 'Multivitamin Drink');
  assert.equal(f.basis, 'ml');
  assert.equal(f.per100.kcal, 40);
  assert.equal(f.per100.salt, 0.05);
  assert.deepEqual(f.per100.micro, { sodium: 20, vitaminC: 24, vitaminD: 1 });
});

test('pace windows: values, ranges, miles, paces inside cues', async () => {
  const { readPace, paceInText, cueWords, paceVerdict, formatPaceRange } = await import('./track.ts');
  assert.deepEqual(readPace('7:30'), { fast: 450, slow: 450 });
  assert.deepEqual(readPace('7:15-8:15 /km'), { fast: 435, slow: 495 });
  assert.deepEqual(readPace('8:15–7:15 min/km'), { fast: 435, slow: 495 });
  assert.deepEqual(readPace({ from: '7:15', to: '8:15' }), { fast: 435, slow: 495 });
  assert.deepEqual(readPace(450), { fast: 450, slow: 450 });
  assert.equal(readPace('fast'), undefined);
  assert.equal(readPace('1:55 /500m'), undefined);
  assert.equal(readPace(undefined), null);
  assert.equal(Math.round(readPace('12:00 /mi')!.fast), 447);
  assert.deepEqual(paceInText('Easy walk 10:00–12:00 min/km'), { fast: 600, slow: 720 });
  assert.equal(paceInText('Easy jog'), null);
  assert.equal(cueWords('Easy walk 10:00–12:00 min/km'), 'Easy walk');
  assert.equal(cueWords('7:30 /km'), '');
  const w = { fast: 435, slow: 495 };
  assert.equal(paceVerdict(470, w), 'on');
  assert.equal(paceVerdict(530, w), 'slow');
  assert.equal(paceVerdict(400, w), 'fast');
  assert.equal(formatPaceRange(w), '7:15–8:15 /km');
  assert.equal(formatPaceRange({ fast: 450, slow: 450 }), '7:30 /km');
});

test('import: a run/walk entry keeps its paces, cues and lengths; bad values are named', async () => {
  const { readIntervals } = await import('./importer.ts');
  const plan = readIntervals({
    activityType: 'Running', warmupSeconds: 300, workSeconds: 90, recoverySeconds: 120, rounds: 6, cooldownSeconds: 300,
    workCue: '7:30 /km', recoveryCue: 'Easy walk 10:00–12:00 min/km', countdownSeconds: 5,
  });
  assert.ok(typeof plan !== 'string');
  assert.deepEqual(plan.workPace, { fast: 450, slow: 450 });
  assert.deepEqual(plan.recoveryPace, { fast: 600, slow: 720 });
  assert.equal(plan.rounds, 6);
  assert.equal(plan.countdown, 5);
  const explicit = readIntervals({ activityType: 'jog', workMinutes: 2, rounds: 3, workPace: '7:15-8:15', warmupPace: '10:30-12:30', warmupMinutes: 5, warmupCue: 'Brisk walk' });
  assert.ok(typeof explicit !== 'string');
  assert.equal(explicit.activity, 'Running');
  assert.equal(explicit.workSeconds, 120);
  assert.equal(explicit.warmupSeconds, 300);
  assert.deepEqual(explicit.warmupPace, { fast: 630, slow: 750 });
  assert.match(readIntervals({ activityType: 'Skating', workSeconds: 60 }) as string, /not one of/);
  assert.match(readIntervals({ workSeconds: 60, workPace: 'quick' }) as string, /workPace "quick" is not a pace/);
  assert.match(readIntervals({ workSeconds: 60, rounds: 0 }) as string, /rounds/);
});

test('voice coach lines: phase, length, round, rounds left, cue and pace', async () => {
  const { announce, timeline } = await import('./intervals.ts');
  const p: IntervalPlan = {
    activity: 'Running', warmupSeconds: 300, workSeconds: 90, recoverySeconds: 120, rounds: 3, cooldownSeconds: 300,
    workCue: 'Jog', recoveryCue: 'Easy walk 10:00–12:00 min/km', countdown: 5, workPace: { fast: 450, slow: 450 },
  };
  const t = timeline(p);
  assert.equal(announce(p, t, 0), 'Warm-up, 5 minutes. Easy.');
  assert.equal(announce(p, t, 1), 'Round 1 of 3. Work, 90 seconds. Jog. Target pace 7 30 per kilometre.');
  assert.equal(announce(p, t, 2), 'Recover, 2 minutes. 2 rounds to go. Easy walk. Pace 10 to 12 minutes per kilometre.');
  assert.equal(announce(p, t, 5), 'Last round, 3 of 3. Work, 90 seconds. Jog. Target pace 7 30 per kilometre.');
  assert.equal(announce(p, t, 6), 'All rounds done. Cool-down, 5 minutes. Ease down.');
  assert.equal(announce(p, t, 7), 'Workout complete. Well done.');
});

test('supplement pack: what is left, days left and when to say buy it again', async () => {
  const { stockLeft, daysLeft, restockAt, doseInUnit, formatAmount } = await import('./supplements.ts');
  const base = { id: 's', name: 'Creatine', brand: null, image: null, barcode: null, time: '08:00', per100: null, micros: [], createdAt: '2026-10-01T00:00:00Z' };
  const caps = { ...base, dose: 2, unit: 'capsule' as const, servingG: 0.5, stock: { total: 60, unit: 'capsule' as const, left: 10, at: '2026-10-20T00:00:00Z' } };
  const tick = (date: string) => ({ id: date, date, supplementId: 's', name: 'Creatine', dose: '2 capsules', takenAt: `${date}T08:05:00Z`, nutrients: null });
  const intakes = [tick('2026-10-19'), tick('2026-10-21'), tick('2026-10-22')];
  assert.equal(stockLeft(caps, intakes), 6); // the tick before the pack was set does not count
  assert.equal(daysLeft(caps, intakes), 3);
  // Three doses left, today's not taken: they last today, tomorrow and the day after, so remind today.
  const now = new Date(2026, 9, 23, 7, 0);
  assert.equal(restockAt(caps, intakes, now)!.getDate(), 23);
  // Today's taken: three doses cover the next three days; remind tomorrow.
  assert.equal(restockAt(caps, [...intakes.slice(0, 2), tick('2026-10-23')], now)!.getDate(), 24);
  // A 5 g dose from a pack weighed in grams; capsules counted from a dose in grams.
  const powder = { ...base, dose: 5, unit: 'g' as const, servingG: null, stock: { total: 500, unit: 'g' as const, left: 500, at: '2026-10-20T00:00:00Z' } };
  assert.equal(daysLeft(powder, []), 100);
  assert.equal(doseInUnit({ dose: 1, unit: 'g', servingG: 0.5 }, 'capsule'), 2);
  assert.equal(doseInUnit({ dose: 2, unit: 'scoop', servingG: null }, 'g'), null);
  assert.equal(formatAmount(6, 'capsule'), '6 capsules');
  assert.equal(formatAmount(380.4, 'g'), '380 g');
});

test('intake reminders come back until answered, and a skip counts as an answer', async () => {
  const { reminderPlan } = await import('./supplements.ts');
  const x = { id: 'c', name: 'Creatine', brand: null, image: null, barcode: null, dose: 5, unit: 'g' as const, time: '08:00', per100: null, servingG: null, micros: [], createdAt: '2026-01-01T00:00:00Z' };
  const now = new Date(2026, 0, 10, 8, 20);
  const plan = reminderPlan([x], [], now, 2, { nags: [15, 30, 60] });
  // Today 08:00 has passed: its 08:30 and 09:00 repeats remain, then tomorrow's reminder and its three repeats.
  assert.deepEqual(plan.map((r) => r.id), ['intake-2026-01-10-0800-n2', 'intake-2026-01-10-0800-n3', 'intake-2026-01-11-0800', 'intake-2026-01-11-0800-n1', 'intake-2026-01-11-0800-n2', 'intake-2026-01-11-0800-n3']);
  const skipped = reminderPlan([x], [], now, 2, { nags: [15, 30, 60], skipped: [{ supplementId: 'c', date: '2026-01-10' }] });
  assert.equal(skipped[0].id, 'intake-2026-01-11-0800');
});

test('pack size from a label quantity', async () => {
  const { packFromText } = await import('./supplements.ts');
  assert.deepEqual(packFromText('120 capsules'), { total: 120, unit: 'capsule' });
  assert.deepEqual(packFromText('1 kg'), { total: 1000, unit: 'g' });
  assert.deepEqual(packFromText('300g'), { total: 300, unit: 'g' });
  assert.deepEqual(packFromText('60 gélules'), { total: 60, unit: 'capsule' });
  assert.deepEqual(packFromText('90 comprimés'), { total: 90, unit: 'tablet' });
  assert.deepEqual(packFromText('0,5 l'), { total: 500, unit: 'ml' });
  assert.equal(packFromText(''), null);
});

test('weight for a target RIR from a set done with its RIR', async () => {
  const { loadForRir } = await import('./calc.ts');
  // 100 kg x 8 with 2 in reserve = 10 possible. 8 reps at RIR 1 wants 9 possible: a little heavier.
  assert.equal(Math.round(loadForRir({ loadKg: 100, reps: 8, rir: 2 }, 8, 1)! * 10) / 10, 102.6);
  // Same reps and RIR: same weight.
  assert.ok(Math.abs(loadForRir({ loadKg: 60, reps: 10, rir: 2 }, 10, 2)! - 60) < 1e-9);
  // Too easy last time (RIR 5 at 10 reps) for 10 at RIR 2: heavier.
  assert.ok(loadForRir({ loadKg: 25, reps: 10, rir: 5 }, 10, 2)! > 25);
  assert.equal(loadForRir({ loadKg: 25, reps: 10, rir: null }, 10, 2), null);
  assert.equal(loadForRir({ loadKg: 25, reps: 15, rir: 3 }, 10, 2), null); // 18 possible: past what Epley holds
});

test('import: rest days, the period, and replacing what is planned in it', async () => {
  const { parseTrainingFile, applyChoices } = await import('./importer.ts');
  const all = [{ id: 'bench-press', name: 'Barbell Bench Press', primary: [], secondary: [], equipment: 'barbell' }] as any;
  const file = JSON.stringify({ format: 'beyond-training', version: 1, id: 'f', entries: [
    { id: 'a', date: '2030-01-01', type: 'strength', exercises: [{ name: 'Bench Press' }] },
    { id: 'r', date: '2030-01-02', type: 'rest' },
    { id: 'b', date: '2030-01-04', type: 'strength', exercises: [{ name: 'Bench Press' }] },
  ] });
  const mine = { id: 'm', programId: null, dayId: null, name: 'Mine', date: '2030-01-03', plan: [], sets: [], startedAt: null, finishedAt: null, sessionRpe: null, notes: '' };
  const r = parseTrainingFile(file, all, { sessions: [mine], cardio: [] });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.period, { from: '2030-01-01', until: '2030-01-04' });
  assert.deepEqual(r.rest, ['2030-01-02']);
  assert.deepEqual(r.plannedInPeriod.map((x) => x.id), ['m']);
  const keep = applyChoices(r, {});
  assert.deepEqual(keep.remove, []);
  assert.deepEqual(keep.rest.days, ['2030-01-02']);
  const replace = applyChoices(r, {}, 'replace');
  assert.deepEqual(replace.remove, ['m']);
  assert.deepEqual(replace.rest.days, ['2030-01-02', '2030-01-03']); // the empty day becomes rest too
  assert.equal(replace.sessions.length, 2);
});

test('cardio: WHO minutes, VDOT, Riegel, load ratio', async () => {
  const { guidelineMinutes, vdot, riegel, fitness, loadReport } = await import('./cardioStats.ts');
  const c = (date: string, minutes: number, rpe: number | null, extra: Partial<CardioSession> = {}): CardioSession =>
    ({ id: date + minutes, date, activity: 'Running', minutes, distanceKm: null, rpe, avgHr: null, plan: null, completed: true, notes: '', ...extra });
  const week = guidelineMinutes([c('2026-10-20', 30, 5), c('2026-10-22', 20, 8)], Date.parse('2026-10-19T00:00:00'), Date.parse('2026-10-26T00:00:00'));
  assert.deepEqual(week, { moderate: 30, vigorous: 20, equivalent: 70 });
  // A 20:00 5 km is VDOT ~49.8 on the Daniels tables.
  assert.ok(Math.abs(vdot(5, 20)! - 49.8) < 0.5);
  assert.ok(Math.abs(riegel(5, 20, 10) - 41.7) < 0.1);
  // Intervals and easy runs do not count as a race effort.
  assert.equal(fitness([c('2026-10-20', 30, 5, { distanceKm: 5 })]), null);
  assert.equal(fitness([c('2026-10-20', 25, 8, { distanceKm: 5, plan: { activity: 'Running', warmupSeconds: 0, workSeconds: 60, recoverySeconds: 60, rounds: 6, cooldownSeconds: 0, workCue: '', recoveryCue: '', countdown: 5 } })]), null);
  assert.equal(Math.round(fitness([c('2026-10-20', 20, 8, { distanceKm: 5 })])!.vdot), 50);
  const days = [
    ...[1, 2, 3, 4].map((w) => ({ date: new Date(2026, 9, 25 - 7 * w).toISOString().slice(0, 10), load: 300 })),
    { date: '2026-10-24', load: 600 },
  ];
  const r = loadReport(days, new Date(2026, 9, 25, 12));
  assert.equal(r.ratio, 2);
});

test('planned sets: warm-up ramp up to the weight that should leave the target RIR', async () => {
  const { planSets } = await import('./calc.ts');
  const p: Prescription = { exerciseId: 'bench-press', sets: 3, minReps: 8, maxReps: 12, rir: 2, restSeconds: 150, loadKg: null, warmupSets: 2 };
  const done = session('2026-10-20', [set(10, 60, 4, { exerciseId: 'bench-press' })]);
  const r = planSets(p, [done], (kg) => Math.round(kg / 2.5) * 2.5);
  // 60 × 10 with 4 left = 14 possible; 10 reps at RIR 2 = 12 possible: heavier.
  assert.equal(r.workKg, 62.5);
  assert.deepEqual(r.warmups.map((w) => [w.kg, w.reps]), [[25, 6], [50, 4]]);
  assert.equal(r.working.length, 3);
  assert.equal(r.working[0].reps, '8–12');
  assert.equal(planSets({ ...p, loadKg: 70 }, [done], (kg) => kg).workKg, 70);
  assert.equal(planSets(p, [], (kg) => kg).workKg, null);
});

test('import: warm-ups written out per exercise replace the default ramp', async () => {
  const { parseTrainingFile } = await import('./importer.ts');
  const { planSets } = await import('./calc.ts');
  const all = [{ id: 'bench-press', name: 'Barbell Bench Press', primary: [], secondary: [], equipment: 'barbell' }] as any;
  const file = JSON.stringify({ format: 'beyond-training', version: 1, id: 'w', entries: [
    { id: 'a', date: '2030-01-01', type: 'strength', exercises: [{ name: 'Bench Press', sets: 3, minReps: 6, maxReps: 10, loadKg: 80, warmups: [{ percent: 40, reps: 10 }, { percent: 60, reps: 6 }, { percent: 80, reps: 3 }] }] },
  ] });
  const r = parseTrainingFile(file, all, { sessions: [], cardio: [] });
  const p = r.sessions[0].plan[0];
  assert.equal(p.warmupSets, 3);
  assert.deepEqual(planSets(p, [], (kg) => kg).warmups.map((w) => [w.kg, w.reps]), [[32, 10], [48, 6], [64, 3]]);
});

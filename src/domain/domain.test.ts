import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadBarbell, toKg, toDisplay } from './plates.ts';
import { e1rm, rirToRpe, repDrop, progression, fatigueReport, personalRecords } from './calc.ts';
import { timeline, position, beepFor, elapsed, pause, resume, skip, totalSeconds } from './intervals.ts';
import { fromOff, scale, startingTargets } from './nutrition.ts';
import { parseTrainingFile } from './importer.ts';
import type { Exercise, Session, WorkoutSet, Prescription, IntervalPlan } from './types.ts';

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

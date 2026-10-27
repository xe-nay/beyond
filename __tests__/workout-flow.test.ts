/// <reference types="jest" />
// The workout flow on the store, as the app drives it: import a plan, start today's workout, discard,
// log warm-ups and sets, and what Today shows after each step.
import { exercises } from '../src/catalog';
import { applyChoices, parseTrainingFile } from '../src/domain/importer';
import { plannedFor } from '../src/schedule';
import { today, useStore } from '../src/store';

const day = today();
const plan = JSON.stringify({
  format: 'beyond-training', version: 1, id: 'test-plan',
  entries: [
    { id: 'upper', date: day, type: 'strength', name: 'Upper A', exercises: [
      { name: 'Incline Dumbbell Press', sets: 3, minReps: 8, maxReps: 12, rir: 2, restSeconds: 150, warmupSets: 2 },
      { name: 'Seated Cable Row', sets: 3, minReps: 8, maxReps: 12, rir: 2, restSeconds: 150, warmupSets: 1 },
    ] },
  ],
});

function importPlan() {
  const s = useStore.getState();
  const r = parseTrainingFile(plan, exercises, { sessions: s.sessions, cardio: s.cardio });
  expect(r.errors).toEqual([]);
  const a = applyChoices(r, {}, 'replace');
  s.importData(a.sessions, a.cardio, a.remove, a.rest);
}

beforeEach(() => {
  useStore.getState().reset();
  importPlan();
});

test('today shows the imported workout', () => {
  const p = plannedFor(useStore.getState(), day, day);
  expect(p.sessions.map((x) => x.name)).toEqual(['Upper A']);
});

test('discarding a started imported workout keeps it planned for today', () => {
  const s = useStore.getState();
  const id = plannedFor(s, day, day).sessions[0].id;
  s.startSession({ sessionId: id });
  s.logSet(id, { exerciseId: s.sessions.find((x) => x.id === id)!.plan[0].exerciseId, loadKg: 10, reps: 8, rir: 3, warmup: true });
  useStore.getState().discardSession(id);
  const after = useStore.getState();
  const p = plannedFor(after, day, day);
  expect(p.sessions.map((x) => x.name)).toEqual(['Upper A']);
  expect(p.sessions[0].sets).toEqual([]);
  expect(after.activeSession).toBeNull();
});

test('starting another workout leaves an untouched imported one planned', () => {
  const s = useStore.getState();
  const id = plannedFor(s, day, day).sessions[0].id;
  s.startSession({ sessionId: id });
  useStore.getState().startSession({ empty: true });
  expect(plannedFor(useStore.getState(), day, day).sessions.map((x) => x.id)).toEqual([id]);
});

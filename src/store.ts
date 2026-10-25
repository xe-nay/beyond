import { create } from 'zustand';

import { byId } from './catalog';
import { sum } from './domain/nutrition';
import { generateProgram, TEMPLATES } from './domain/program';
import { doseNutrients, formatDose } from './domain/supplements';
import type {
  BodyEntry, CardioSession, Food, FoodEntry, Intake, IntervalPlan, Meal, NutritionTargets, Prescription, Profile, Program,
  RecoveryCheck, Session, Supplement, TimerSettings, WorkoutSet,
} from './domain/types';
import { loadJson, saveJson } from './storage';

export const today = (d = new Date()) => {
  const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return x.toISOString().slice(0, 10);
};
/** Local time as "HH:MM". */
export const clock = (d = new Date()) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
/** A food entry set later than now is a planned meal: shown, reminded, not yet counted. */
export const isPlanned = (e: Pick<FoodEntry, 'date' | 'time'>, now = new Date()) => `${e.date}T${e.time ?? '00:00'}` > `${today(now)}T${clock(now)}`;
export const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export interface Period { from: string; until: string | null }

export interface Rest { endsAt: number | null; total: number; paused: number | null; exerciseId: string | null; sessionId: string | null }

interface Data {
  version: 1;
  profile: Profile;
  timer: TimerSettings;
  programs: Program[];
  activeProgram: string | null;
  sessions: Session[];
  cardio: CardioSession[];
  foods: Record<string, Food>;
  entries: FoodEntry[];
  targets: NutritionTargets;
  body: BodyEntry[];
  checks: RecoveryCheck[];
  activeSession: string | null;
  rest: Rest;
  analyticsLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  cardioRun: { id: string; date: string; plan: IntervalPlan; banked: number; resumedAt: number | null; gpsMeters?: number } | null;
  cardioPlans: IntervalPlan[];
  supplements: Supplement[];
  intakes: Intake[];
}

const initial: Data = {
  version: 1,
  profile: {
    name: '', unit: 'kg', goal: 'hypertrophy', experience: 'intermediate', days: 4, minutes: 60,
    equipment: ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'kettlebell', 'band'],
    sex: null, birthYear: null, heightCm: null, onboarded: false,
  },
  timer: { autoStart: true, sound: true, volume: 0.8, countdown: 5, haptics: true, cue: 'beeps', defaultRest: 120 },
  programs: [],
  activeProgram: null,
  sessions: [],
  cardio: [],
  foods: {},
  entries: [],
  targets: { kcal: 2400, protein: 150, carbs: 260, fat: 75 },
  body: [],
  checks: [],
  activeSession: null,
  rest: { endsAt: null, total: 0, paused: null, exerciseId: null, sessionId: null },
  analyticsLevel: 'intermediate',
  cardioRun: null,
  cardioPlans: [],
  supplements: [],
  intakes: [],
};

interface Actions {
  hydrate(): void;
  set(patch: Partial<Data>): void;
  setProfile(patch: Partial<Profile>): void;
  setTimer(patch: Partial<TimerSettings>): void;
  useTemplate(templateId: string, period?: Period): void;
  generate(period?: Period): void;
  /** Removes workouts planned (not started) between two dates, for a new program to take over. */
  clearPlanned(from: string, until: string | null): void;
  saveProgram(p: Program): void;
  updatePrescription(programId: string, dayId: string, index: number, patch: Partial<Prescription> | null): void;
  addToDay(programId: string, dayId: string, exerciseId: string): void;
  startSession(input: { dayId?: string; sessionId?: string; empty?: boolean }): string;
  logSet(sessionId: string, set: Omit<WorkoutSet, 'id' | 'completedAt' | 'restSeconds'>): WorkoutSet;
  updateSet(sessionId: string, setId: string, patch: Partial<WorkoutSet>): void;
  deleteSet(sessionId: string, setId: string): void;
  patchPlan(sessionId: string, index: number, patch: Partial<Prescription> | null): void;
  addPlanExercise(sessionId: string, exerciseId: string): void;
  patchSession(sessionId: string, patch: Partial<Session>): void;
  finishSession(sessionId: string, rpe: number | null): void;
  discardSession(sessionId: string): void;
  startRest(seconds: number, exerciseId: string | null, sessionId: string | null): void;
  pauseRest(): void;
  resumeRest(): void;
  addRest(seconds: number): void;
  stopRest(): void;
  saveFood(food: Food): void;
  toggleFavorite(id: string): void;
  logFood(food: Food, amount: number, meal: Meal, date: string, nutrients: FoodEntry['nutrients'], time?: string): void;
  deleteEntry(id: string): void;
  saveSupplement(x: Supplement): void;
  deleteSupplement(id: string): void;
  /** Ticks or unticks a supplement as taken on a date. */
  toggleIntake(supplementId: string, date: string): void;
  saveCardio(c: CardioSession): void;
  deleteCardio(id: string): void;
  saveBody(b: BodyEntry): void;
  deleteBody(id: string): void;
  saveCheck(c: RecoveryCheck): void;
  /** Adds imported entries next to everything else; only same ids and the ids in remove are replaced. */
  importData(sessions: Session[], cardio: CardioSession[], remove?: string[]): void;
  replaceAll(data: Partial<Data>): void;
  reset(): void;
}

export type State = Data & Actions & { ready: boolean };

let saveTimer: ReturnType<typeof setTimeout> | null = null;
const persist = (s: State) => {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const { ready, ...rest } = s;
    const data = Object.fromEntries(Object.entries(rest).filter(([, v]) => typeof v !== 'function'));
    saveJson('state.json', data);
  }, 250);
};

const mapSession = (sessions: Session[], id: string, fn: (s: Session) => Session) => sessions.map((s) => (s.id === id ? fn(s) : s));

export const useStore = create<State>((set, get) => ({
  ...initial,
  ready: false,

  hydrate() {
    const saved = loadJson<Partial<Data>>('state.json');
    set({ ...initial, ...saved, profile: { ...initial.profile, ...saved?.profile }, timer: { ...initial.timer, ...saved?.timer }, ready: true });
  },
  set(patch) { set(patch); },
  setProfile(patch) { set((s) => ({ profile: { ...s.profile, ...patch } })); },
  setTimer(patch) { set((s) => ({ timer: { ...s.timer, ...patch } })); },

  useTemplate(templateId, period) {
    const t = TEMPLATES.find((x) => x.id === templateId)!;
    const profile = { ...get().profile, ...t.profile };
    const p = { ...generateProgram(profile, byId), ...period };
    p.name = t.name;
    set((s) => ({ programs: [p, ...s.programs], activeProgram: p.id }));
  },
  generate(period) {
    const p = { ...generateProgram(get().profile, byId), ...period };
    set((s) => ({ programs: [p, ...s.programs], activeProgram: p.id }));
  },
  clearPlanned(from, until) {
    set((s) => ({ sessions: s.sessions.filter((x) => x.startedAt || x.finishedAt || x.date < from || (until !== null && x.date > until)) }));
  },
  saveProgram(p) {
    set((s) => ({ programs: s.programs.some((x) => x.id === p.id) ? s.programs.map((x) => (x.id === p.id ? p : x)) : [p, ...s.programs] }));
  },
  updatePrescription(programId, dayId, index, patch) {
    set((s) => ({
      programs: s.programs.map((p) => p.id !== programId ? p : {
        ...p,
        days: p.days.map((d) => d.id !== dayId ? d : {
          ...d,
          exercises: patch === null ? d.exercises.filter((_, i) => i !== index) : d.exercises.map((x, i) => (i === index ? { ...x, ...patch } : x)),
        }),
      }),
    }));
  },
  addToDay(programId, dayId, exerciseId) {
    set((s) => ({
      programs: s.programs.map((p) => p.id !== programId ? p : {
        ...p,
        days: p.days.map((d) => d.id !== dayId ? d : { ...d, exercises: [...d.exercises, { exerciseId, sets: 3, minReps: 8, maxReps: 12, rir: 2, restSeconds: s.timer.defaultRest ?? 120, loadKg: null }] }),
      }),
    }));
  },

  startSession({ dayId, sessionId, empty }) {
    const s = get();
    const open = s.sessions.find((x) => x.id === (sessionId ?? s.activeSession) && !x.finishedAt);
    if (open && (sessionId || !dayId)) {
      set({ activeSession: open.id, sessions: mapSession(s.sessions, open.id, (x) => ({ ...x, startedAt: x.startedAt ?? new Date().toISOString() })) });
      return open.id;
    }
    // Starting something else: an untouched open workout is dropped, one with sets is saved.
    if (open) {
      if (open.sets.length) get().finishSession(open.id, open.sessionRpe);
      else if (open.source !== 'import') get().discardSession(open.id);
    }
    const program = s.programs.find((p) => p.id === s.activeProgram);
    const day = program?.days.find((d) => d.id === dayId);
    const session: Session = {
      id: uid(), programId: program?.id ?? null, dayId: day?.id ?? null, name: empty || !day ? 'Free workout' : day.name,
      date: today(), plan: empty || !day ? [] : day.exercises.map((x) => ({ ...x })), sets: [],
      startedAt: new Date().toISOString(), finishedAt: null, sessionRpe: null, notes: '', source: 'app',
    };
    set({ sessions: [...get().sessions, session], activeSession: session.id });
    return session.id;
  },
  logSet(sessionId, input) {
    const s = get();
    const session = s.sessions.find((x) => x.id === sessionId)!;
    const last = [...session.sets].reverse()[0];
    const rest = s.rest.sessionId === sessionId && last ? Math.round((Date.now() - Date.parse(last.completedAt)) / 1000) : null;
    const entry: WorkoutSet = { ...input, id: uid(), completedAt: new Date().toISOString(), restSeconds: rest };
    set({ sessions: mapSession(s.sessions, sessionId, (x) => ({ ...x, sets: [...x.sets, entry] })) });
    return entry;
  },
  updateSet(sessionId, setId, patch) {
    set((s) => ({ sessions: mapSession(s.sessions, sessionId, (x) => ({ ...x, sets: x.sets.map((y) => (y.id === setId ? { ...y, ...patch } : y)) })) }));
  },
  deleteSet(sessionId, setId) {
    set((s) => ({ sessions: mapSession(s.sessions, sessionId, (x) => ({ ...x, sets: x.sets.filter((y) => y.id !== setId) })) }));
  },
  patchPlan(sessionId, index, patch) {
    set((s) => ({
      sessions: mapSession(s.sessions, sessionId, (x) => ({
        ...x,
        plan: patch === null ? x.plan.filter((_, i) => i !== index) : x.plan.map((p, i) => (i === index ? { ...p, ...patch } : p)),
      })),
    }));
  },
  addPlanExercise(sessionId, exerciseId) {
    set((s) => ({ sessions: mapSession(s.sessions, sessionId, (x) => ({ ...x, plan: [...x.plan, { exerciseId, sets: 3, minReps: 8, maxReps: 12, rir: 2, restSeconds: s.timer.defaultRest ?? 120, loadKg: null }] })) }));
  },
  patchSession(sessionId, patch) {
    set((s) => ({ sessions: mapSession(s.sessions, sessionId, (x) => ({ ...x, ...patch })) }));
  },
  finishSession(sessionId, rpe) {
    set((s) => ({
      sessions: mapSession(s.sessions, sessionId, (x) => ({ ...x, finishedAt: new Date().toISOString(), sessionRpe: rpe, startedAt: x.startedAt ?? new Date().toISOString() })),
      activeSession: null,
      rest: initial.rest,
    }));
  },
  discardSession(sessionId) {
    set((s) => ({ sessions: s.sessions.filter((x) => x.id !== sessionId), activeSession: s.activeSession === sessionId ? null : s.activeSession, rest: initial.rest }));
  },

  startRest(seconds, exerciseId, sessionId) {
    set({ rest: { endsAt: Date.now() + seconds * 1000, total: seconds, paused: null, exerciseId, sessionId } });
  },
  pauseRest() {
    const r = get().rest;
    if (r.endsAt) set({ rest: { ...r, paused: Math.max(0, r.endsAt - Date.now()), endsAt: null } });
  },
  resumeRest() {
    const r = get().rest;
    if (r.paused !== null) set({ rest: { ...r, endsAt: Date.now() + r.paused, paused: null } });
  },
  addRest(seconds) {
    const r = get().rest;
    if (r.endsAt) set({ rest: { ...r, endsAt: Math.max(Date.now(), r.endsAt + seconds * 1000), total: Math.max(1, r.total + seconds) } });
    else if (r.paused !== null) set({ rest: { ...r, paused: Math.max(0, r.paused + seconds * 1000), total: Math.max(1, r.total + seconds) } });
  },
  stopRest() { set({ rest: initial.rest }); },

  saveFood(food) { set((s) => ({ foods: { ...s.foods, [food.id]: { ...s.foods[food.id], ...food, favorite: s.foods[food.id]?.favorite ?? food.favorite } } })); },
  toggleFavorite(id) { set((s) => (s.foods[id] ? { foods: { ...s.foods, [id]: { ...s.foods[id], favorite: !s.foods[id].favorite } } } : {})); },
  logFood(food, amount, meal, date, nutrients, time = clock()) {
    get().saveFood({ ...food, lastUsed: new Date().toISOString() });
    const entry: FoodEntry = { id: uid(), date, meal, foodId: food.id, name: food.name, brand: food.brand, image: food.image, amount, basis: food.basis, nutrients, loggedAt: new Date().toISOString(), time };
    set((s) => ({ entries: [...s.entries, entry] }));
  },
  deleteEntry(id) { set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })); },
  saveSupplement(x) {
    // Today's and later ticks take the new dose and label values; earlier days keep what was recorded.
    const from = today();
    set((s) => ({
      supplements: [...s.supplements.filter((y) => y.id !== x.id), x],
      intakes: s.intakes.map((i) => (i.supplementId === x.id && i.date >= from ? { ...i, name: x.name, dose: formatDose(x), nutrients: doseNutrients(x) } : i)),
    }));
  },
  deleteSupplement(id) { set((s) => ({ supplements: s.supplements.filter((y) => y.id !== id), intakes: s.intakes.filter((i) => i.supplementId !== id || i.date < today()) })); },
  toggleIntake(supplementId, date) {
    const s = get();
    const had = s.intakes.find((i) => i.supplementId === supplementId && i.date === date);
    if (had) return set({ intakes: s.intakes.filter((i) => i !== had) });
    const x = s.supplements.find((y) => y.id === supplementId);
    if (!x) return;
    set({ intakes: [...s.intakes, { id: uid(), date, supplementId, name: x.name, dose: formatDose(x), takenAt: new Date().toISOString(), nutrients: doseNutrients(x) }] });
  },

  saveCardio(c) { set((s) => ({ cardio: s.cardio.some((x) => x.id === c.id) ? s.cardio.map((x) => (x.id === c.id ? c : x)) : [...s.cardio, c] })); },
  deleteCardio(id) { set((s) => ({ cardio: s.cardio.filter((x) => x.id !== id) })); },
  saveBody(b) { set((s) => ({ body: [...s.body.filter((x) => x.id !== b.id), b].sort((a, z) => a.date.localeCompare(z.date)) })); },
  deleteBody(id) { set((s) => ({ body: s.body.filter((x) => x.id !== id) })); },
  saveCheck(c) { set((s) => ({ checks: [...s.checks.filter((x) => x.date !== c.date), c] })); },

  importData(sessions, cardio, remove = []) {
    const out = new Set([...remove, ...sessions.map((x) => x.id), ...cardio.map((x) => x.id)]);
    set((s) => ({
      sessions: [...s.sessions.filter((x) => !out.has(x.id)), ...sessions],
      cardio: [...s.cardio.filter((x) => !out.has(x.id)), ...cardio],
    }));
  },
  replaceAll(data) { set({ ...initial, ...data, ready: true }); },
  reset() { set({ ...initial, ready: true }); },
}));

useStore.subscribe((s) => s.ready && persist(s));

export const activeProgram = (s: State) => s.programs.find((p) => p.id === s.activeProgram) ?? null;
/** What a ticked supplement added; ticks saved before label values existed use the supplement's values now. */
export const intakeNutrients = (s: Pick<Data, 'supplements'>, i: Intake) => {
  if (i.nutrients) return i.nutrients;
  const x = s.supplements.find((y) => y.id === i.supplementId);
  return x ? doseNutrients(x) : null;
};

/** Everything eaten on a date: logged food plus supplements ticked as taken. */
export const eatenOn = (s: Data, date: string) =>
  sum([
    ...s.entries.filter((e) => e.date === date && !isPlanned(e)).map((e) => e.nutrients),
    ...s.intakes.filter((i) => i.date === date).map((i) => intakeNutrients(s, i)).filter((n): n is NonNullable<typeof n> => !!n),
  ]);
export const finished = (s: State) => s.sessions.filter((x) => x.finishedAt);
export const latestWeight = (s: State) => [...s.body].reverse().find((b) => b.weightKg)?.weightKg ?? null;

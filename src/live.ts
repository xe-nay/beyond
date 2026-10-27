// Keeps the Lock Screen / Dynamic Island activity in step with the live session. Only changes the
// user can see are sent (a set logged, a rest started or ended, a new phase, a pause); the clocks are
// drawn by the system, so nothing needs to tick from here.
import { AppState } from 'react-native';

import { endLive, liveAvailable, liveLog, startLive, updateLive, type LiveState } from '../modules/live-activity';
import { exercise } from './catalog';
import { currentExercise } from './components/WorkoutDock';
import { elapsed, position, timeline } from './domain/intervals';
import { useStore, type State } from './store';

const PHASE_COLOR = { warmup: '#FFB340', work: '#40E0F0', recovery: '#C2F95C', cooldown: '#7D8BFF' } as const;
const PHASE_LABEL = { warmup: 'Warm-up', work: 'Work', recovery: 'Recover', cooldown: 'Cool-down' } as const;
const ACTIVITY: Record<string, string> = { Running: 'figure.run', Walking: 'figure.walk', Cycling: 'bicycle', Rowing: 'figure.rower', Swimming: 'figure.pool.swim', HIIT: 'figure.highintensity.intervaltraining' };

export function liveState(s: State): { name: string; state: LiveState } | null {
  const run = s.cardioRun;
  // A cardio run that finished but was never saved must not hide a workout in progress.
  const pos = run ? position(timeline(run.plan), elapsed({ banked: run.banked, resumedAt: run.resumedAt })) : null;
  if (run && pos?.phase) {
    const kind = pos.phase.kind;
    const paused = run.resumedAt === null;
    return {
      name: run.plan.activity,
      state: {
        mode: paused ? 'paused' : 'cardio',
        title: run.plan.activity,
        subtitle: `${PHASE_LABEL[kind]}${pos.phase.round ? ` ${pos.phase.round}/${run.plan.rounds}` : ''}${pos.phase.cue ? ` · ${pos.phase.cue}` : ''}`,
        symbol: ACTIVITY[run.plan.activity] ?? 'figure.run',
        accent: PHASE_COLOR[kind],
        endsAt: paused ? null : Date.now() + pos.remaining * 1000,
        total: pos.phase.seconds,
      },
    };
  }
  const session = s.sessions.find((x) => x.id === s.activeSession && !x.finishedAt);
  if (!session) return null;
  const now = currentExercise(session);
  const name = now ? exercise(now.exerciseId)?.name ?? '' : '';
  const next = now?.of ? ` · set ${now.set} of ${now.of}` : '';
  if (s.rest.endsAt || s.rest.paused !== null) {
    return {
      name: session.name,
      state: {
        mode: s.rest.endsAt ? 'rest' : 'paused',
        title: s.rest.endsAt ? 'Rest' : 'Rest paused',
        subtitle: `Next: ${name}${next}`,
        symbol: 'timer',
        accent: '#40E0F0',
        endsAt: s.rest.endsAt,
        total: s.rest.total,
        // With the phone locked the app may not get to update the island when the rest ends, so the
        // island turns itself to "rest over" then, still showing the session's clock.
        startedAt: session.startedAt ? Date.parse(session.startedAt) : null,
        staleAt: s.rest.endsAt,
      },
    };
  }
  return {
    name: session.name,
    state: {
      mode: 'lift',
      title: session.name,
      subtitle: `${name}${next}`,
      symbol: 'dumbbell.fill',
      accent: '#C2F95C',
      startedAt: session.startedAt ? Date.parse(session.startedAt) : Date.now(),
      total: 0,
    },
  };
}

let running = false;
let last = '';
let phaseTimer: ReturnType<typeof setTimeout> | null = null;

let busy = false;
let again = false;
/**
 * Updates go out one at a time; one asked for while another is on its way follows it with the latest
 * state. Two updates sent together could land out of order and leave the older one showing (the
 * session clock over a rest that had just started).
 */
async function sync() {
  if (busy) { again = true; return; }
  busy = true;
  try {
    do { again = false; await push(); } while (again);
  } finally {
    busy = false;
  }
}

async function push() {
  if (!liveAvailable()) return liveLog('sync: Live Activities not available or turned off');
  const s = useStore.getState();
  const next = liveState(s);
  if (!next) {
    liveLog(`sync: nothing live (running=${running})`);
    if (running) await endLive();
    running = false;
    last = '';
    return;
  }
  // Rounded so a phase countdown that is already right is not resent every time.
  const key = JSON.stringify({ ...next.state, endsAt: next.state.endsAt ? Math.round(next.state.endsAt / 2000) : null });
  if (key === last) return;
  last = key;
  liveLog(`sync: ${running ? 'update' : 'start'} ${next.state.mode} "${next.state.title}"`);
  if (!running) running = !!(await startLive(next.name, next.state));
  else await updateLive(next.state);
  // Cardio moves to its next phase on its own; wake up then to show it.
  if (phaseTimer) clearTimeout(phaseTimer);
  if (next.state.mode === 'cardio' && next.state.endsAt) phaseTimer = setTimeout(sync, Math.max(500, next.state.endsAt - Date.now() + 300));
}

useStore.subscribe((s, prev) => {
  if (s.ready && (s.sessions !== prev.sessions || s.rest !== prev.rest || s.cardioRun !== prev.cardioRun || s.activeSession !== prev.activeSession)) sync();
});
/** Shows the live session again from scratch (after the Dynamic Island test in Timer settings replaced it). */
export function resyncLive() {
  running = false;
  last = '';
  return sync();
}

// Coming back always resends: an update sent from the background can be dropped by iOS (while the app
// plays audio), and the island would otherwise keep the old state although the app thinks it is shown.
AppState.addEventListener('change', (st) => {
  if (st !== 'active') return;
  last = '';
  sync();
});

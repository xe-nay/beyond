// The voice coach for guided cardio. It follows the store, not a screen, so it keeps talking with the
// run screen closed or the phone in a pocket: each phase as it starts (length, round, rounds left,
// cue, pace), halfway through long phases, and when the GPS pace leaves the phase's pace window.
import { announce, elapsed, position, spokenTime, timeline } from './domain/intervals';
import { paceVerdict, rollingPace, spokenPace, tracksDistance } from './domain/track';
import { gps } from './gps';
import { say } from './sound';
import { useStore } from './store';

let timer: ReturnType<typeof setInterval> | null = null;
let following: string | null = null;

function coach(runId: string) {
  const said = new Set<string>();
  let index = -1;
  let verdict: 'slow' | 'fast' | 'on' = 'on';
  let since = Date.now();
  let last = 0;
  let warned = false;
  let ended = false;
  return () => {
    const s = useStore.getState();
    const run = s.cardioRun;
    if (!run || run.id !== runId || run.resumedAt === null || s.timer.voiceCoach === false) return;
    const phases = timeline(run.plan);
    const pos = position(phases, elapsed(run));
    const now = Date.now();
    const speak = (key: string, text: string) => {
      if (said.has(key)) return;
      said.add(key);
      last = now;
      say(text);
    };
    if (!pos.phase) {
      // After the closing tone.
      if (!ended) { ended = true; setTimeout(() => say(announce(run.plan, phases, phases.length)), 900); }
      return;
    }
    if (pos.index !== index) { index = pos.index; verdict = 'on'; since = now; warned = false; }
    const into = pos.phase.seconds - pos.remaining;
    // Quiet while the countdown beeps play.
    const quiet = pos.remaining <= run.plan.countdown + 1.5;
    const outdoor = tracksDistance(run.plan.activity);
    // Just after the change tone; not when the app comes back mid-phase.
    if (into >= (pos.index === 0 ? 0.3 : 0.9) && into < 6 && !quiet) speak(`phase${pos.index}`, announce(run.plan, phases, pos.index, outdoor));
    if (pos.phase.seconds >= 240 && into >= pos.phase.seconds / 2 && pos.remaining > 20 && !quiet) speak(`half${pos.index}`, `Halfway. ${spokenTime(pos.remaining)} to go.`);

    const range = outdoor ? pos.phase.pace : null;
    // The rolling pace looks 30 s back, so it waits until that is all this phase.
    const live = range && into >= 30 && !quiet ? rollingPace(gps().samples, now) : null;
    if (!range || !live) return;
    const v = paceVerdict(live, range);
    if (v !== verdict) { verdict = v; since = now; }
    const held = now - since;
    const unit = run.plan.paceUnit ?? 'km';
    const aim = range.fast === range.slow ? spokenPace(range.fast, unit) : `${spokenPace(range.fast, unit)} to ${spokenPace(range.slow, unit)}`;
    if (v !== 'on' && held >= 8000 && now - last >= 40000) {
      last = now;
      warned = true;
      say(`${v === 'slow' ? 'Pick it up' : 'Ease off'}. You're at ${spokenPace(live, unit)}. Aim for ${aim}.`);
    } else if (v === 'on' && held >= 6000 && now - last >= 8000) {
      if (warned) { warned = false; last = now; say('Back on pace.'); }
      else if (pos.phase.kind === 'work') speak(`on${pos.index}`, "You're on pace.");
    }
  };
}

useStore.subscribe((s) => {
  const id = s.cardioRun?.id ?? null;
  if (id === following) return;
  following = id;
  if (timer) clearInterval(timer);
  timer = id ? setInterval(coach(id), 500) : null;
});

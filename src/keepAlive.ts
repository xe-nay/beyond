// Keeps the app running in the background while a workout or cardio session is open (see keepAlive in
// sound.ts), so rest beeps and voices play with the phone locked or another app in front.
import { AppState } from 'react-native';

import { keepAlive } from './sound';
import { useStore, type State } from './store';

const wanted = (s: State) => s.ready && (!!s.cardioRun || s.sessions.some((x) => x.id === s.activeSession && !x.finishedAt));

let on = false;
useStore.subscribe((s) => {
  const w = wanted(s);
  if (w === on) return;
  on = w;
  keepAlive(w);
});
// After a call or another app took the audio, coming back starts the loop again; leaving the app checks
// it is still playing, in the few seconds iOS gives before suspending an app that plays nothing.
AppState.addEventListener('change', (st) => { if (on && st !== 'unknown') keepAlive(true); });

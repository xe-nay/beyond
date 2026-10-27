// Keeps the app running in the background while a workout or cardio session is open, so rest beeps and
// voices play and the Lock Screen / Dynamic Island turns from the rest to the session on time, with the
// phone locked or another app in front.
//
// Two reasons to run, both needed:
// - a silent audio loop (keepAlive in sound.ts): the beeps and voices can then play;
// - low-accuracy background location: iOS refuses Live Activity updates from an app that is "only
//   playing background media" (liveactivitiesd's own log line on the iPhone), so with audio alone the
//   island stayed on "Rest 0:00". It costs little power (3 km accuracy, nothing kept) and iOS shows
//   the blue location pill while it runs.
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { AppState, Platform } from 'react-native';

import { liveLog } from '../modules/live-activity';
import { keepAlive } from './sound';
import { useStore, type State } from './store';

const TASK = 'beyond-awake';
// The locations are not used; receiving them is what keeps the app running.
TaskManager.defineTask(TASK, async () => {});

async function locate(run: boolean) {
  if (Platform.OS !== 'ios') return;
  try {
    const started = await Location.hasStartedLocationUpdatesAsync(TASK).catch(() => false);
    if (!run) {
      if (started) await Location.stopLocationUpdatesAsync(TASK);
      return;
    }
    if (started) return;
    // Starting needs "While using" access and the app on screen (it is: a workout was just started).
    const perm = await Location.getForegroundPermissionsAsync();
    if (!perm.granted && !(perm.canAskAgain && (await Location.requestForegroundPermissionsAsync()).granted)) {
      return liveLog('awake: no location access, the island may lag behind with the phone locked');
    }
    await Location.startLocationUpdatesAsync(TASK, {
      accuracy: Location.Accuracy.Lowest,
      distanceInterval: 0,
      activityType: Location.ActivityType.Fitness,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
    });
    liveLog('awake: background location on');
  } catch (e: any) {
    liveLog(`awake: location failed: ${e?.message ?? e}`);
  }
}

const wanted = (s: State) => s.ready && (!!s.cardioRun || s.sessions.some((x) => x.id === s.activeSession && !x.finishedAt));

let on = false;
useStore.subscribe((s) => {
  const w = wanted(s);
  if (w === on) return;
  on = w;
  keepAlive(w);
  locate(w);
});
// After a call or another app took the audio, coming back starts the loop again; leaving the app checks
// it is still playing, in the few seconds iOS gives before suspending an app that plays nothing.
AppState.addEventListener('change', (st) => {
  if (!on || st === 'unknown') return;
  keepAlive(true);
  if (st === 'active') locate(true);
});

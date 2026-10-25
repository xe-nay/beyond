// GPS distance for outdoor cardio. With "Always" location access the tracking keeps going when the
// phone is locked (iOS shows the blue location pill); with "While using" it runs while Beyond is open.
// Apple Health is not used: it needs an entitlement a free Apple ID cannot sign.
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { step, type Fix, type Sample } from './domain/track';

const TASK = 'beyond-gps';

interface Track { activity: string; meters: number; anchor: Fix | null; samples: Sample[]; paused: boolean; mode: 'background' | 'foreground' | 'off' }
const track: Track = { activity: 'Running', meters: 0, anchor: null, samples: [], paused: false, mode: 'off' };
let watcher: Location.LocationSubscription | null = null;

function take(locations: Location.LocationObject[]) {
  for (const l of locations) {
    const fix: Fix = { lat: l.coords.latitude, lon: l.coords.longitude, t: l.timestamp, accuracy: l.coords.accuracy ?? null };
    if (track.paused) {
      // Moving the anchor while paused keeps the walk to the car out of the distance.
      track.anchor = null;
      continue;
    }
    const r = step(track.anchor, fix, track.activity);
    if (!r) continue;
    track.anchor = r.anchor;
    track.meters += r.add;
    track.samples.push({ t: fix.t, m: track.meters });
    if (track.samples.length > 600) track.samples.splice(0, track.samples.length - 600);
  }
}

// Background updates arrive here, also while the app is not on screen.
TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TASK, async ({ data, error }) => {
  if (!error && data?.locations) take(data.locations);
});

/** Starts tracking (or carries on with a run already tracked). Returns how it runs. */
export async function startGps(activity: string, carried = 0): Promise<Track['mode']> {
  if (track.mode !== 'off') return track.mode;
  Object.assign(track, { activity, meters: carried, anchor: null, samples: [], paused: false });
  try {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (!fg.granted) return 'off';
    const bg = await Location.requestBackgroundPermissionsAsync().catch(() => null);
    const options = { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 5, timeInterval: 1000 };
    if (bg?.granted) {
      await Location.startLocationUpdatesAsync(TASK, {
        ...options,
        activityType: activity === 'Cycling' ? Location.ActivityType.OtherNavigation : Location.ActivityType.Fitness,
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
      });
      track.mode = 'background';
    } else {
      watcher = await Location.watchPositionAsync(options, (l) => take([l]));
      track.mode = 'foreground';
    }
  } catch {
    track.mode = 'off';
  }
  return track.mode;
}

export function pauseGps(paused: boolean) {
  track.paused = paused;
}

export async function stopGps() {
  watcher?.remove();
  watcher = null;
  if (track.mode === 'background') await Location.stopLocationUpdatesAsync(TASK).catch(() => {});
  track.mode = 'off';
}

export const gps = () => ({ meters: track.meters, samples: track.samples, mode: track.mode });

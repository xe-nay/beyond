// Timer sounds and cues. The audio session "ducks" other apps: Spotify or Apple Music gets
// quieter only while a cue plays, and expo-audio restores it when the cue finishes. Each countdown
// is one file, so music dips once per countdown rather than on every tick.
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { Cue } from './domain/types';
import { downloadVoice, voiceUri } from './storage';
import { useStore } from './store';
import { pack } from './voices';

const S = {
  tick: require('../assets/sounds/tick.wav'),
  end: require('../assets/sounds/end.wav'),
  phase: require('../assets/sounds/phase.wav'),
  'count3-end': require('../assets/sounds/count3-end.m4a'),
  'count5-end': require('../assets/sounds/count5-end.m4a'),
  'count10-end': require('../assets/sounds/count10-end.m4a'),
  'count15-end': require('../assets/sounds/count15-end.m4a'),
  'count3-phase': require('../assets/sounds/count3-phase.m4a'),
  'count5-phase': require('../assets/sounds/count5-phase.m4a'),
  'count10-phase': require('../assets/sounds/count10-phase.m4a'),
  'count15-phase': require('../assets/sounds/count15-phase.m4a'),
};
export type Sound = keyof typeof S;

const players = new Map<string, AudioPlayer>();
let current: AudioPlayer | null = null;
let ready = false;

export async function prepareAudio() {
  if (ready) return;
  ready = true;
  try {
    await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'duckOthers', shouldPlayInBackground: true });
  } catch {}
}

function player(key: string, source: number | string) {
  let p = players.get(key);
  if (!p) {
    p = createAudioPlayer(typeof source === 'string' ? { uri: source } : source);
    players.set(key, p);
  }
  return p;
}

function start(key: string, source: number | string) {
  const { sound, volume } = useStore.getState().timer;
  if (!sound || volume <= 0) return;
  try {
    current?.pause();
    const p = player(key, source);
    p.volume = volume;
    current = p;
    p.seekTo(0).then(() => p.play()).catch(() => p.play());
  } catch {}
}

/** Stops whatever cue is playing (pausing or skipping a rest); the music comes back up. */
export function stopCue() {
  try {
    current?.pause();
  } catch {}
  current = null;
}

export function buzz(kind: 'tick' | 'end') {
  if (!useStore.getState().timer.haptics || Platform.OS === 'web') return;
  if (kind === 'tick') Haptics.selectionAsync().catch(() => {});
  else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function play(name: Sound) {
  buzz(name === 'tick' ? 'tick' : 'end');
  start(name, S[name]);
}

/** One file holding N ticks and the closing tone; N is rounded down to an available length. */
export function playCountdown(seconds: number, ending: 'end' | 'phase') {
  const n = [15, 10, 5, 3].find((x) => x <= seconds);
  start(n ? `count${n}-${ending}` : ending, n ? S[`count${n}-${ending}` as Sound] : S[ending]);
}

/** A random clip from the chosen voice pack: the downloaded copy when there is one. */
export function playVoice(cue: Cue) {
  const p = pack(cue);
  if (!p.clips.length) return play('end');
  buzz('end');
  const clip = p.clips[Math.floor(Math.random() * p.clips.length)];
  const source = p.remote ? voiceUri(clip.id) ?? (clip.source as string) : clip.source;
  start(clip.id, source);
}

export function packReady(cue: Cue) {
  const p = pack(cue);
  return !p.remote || Platform.OS === 'web' || p.clips.every((c) => voiceUri(c.id));
}

/** Downloads a coach pack onto the phone so it plays offline. */
export async function downloadPack(cue: Cue, progress?: (done: number, total: number) => void) {
  const p = pack(cue);
  let done = 0;
  for (const c of p.clips) {
    if (!voiceUri(c.id)) await downloadVoice(c.id, c.source as string);
    progress?.(++done, p.clips.length);
  }
}

// A notification is the backstop when the phone is locked or the app is in the background.
Notifications.setNotificationHandler?.({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: false, shouldPlaySound: true, shouldSetBadge: false }),
});

let scheduled: string | null = null;
export async function scheduleEnd(at: number, title: string, body: string) {
  if (Platform.OS === 'web') return;
  await cancelEnd();
  const seconds = Math.round((at - Date.now()) / 1000);
  if (seconds < 2) return;
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted && perm.canAskAgain) await Notifications.requestPermissionsAsync();
    scheduled = await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds },
    });
  } catch {}
}

export async function cancelEnd() {
  if (!scheduled) return;
  const id = scheduled;
  scheduled = null;
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}

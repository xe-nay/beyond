// Timer sounds and cues. The audio session "ducks" other apps: Spotify or Apple Music gets
// quieter only while a cue plays, and expo-audio restores it when the cue finishes. Each countdown
// is one file, so music dips once per countdown rather than on every tick.
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import * as Speech from 'expo-speech';
import { AppState, Platform } from 'react-native';

import type { Cue } from './domain/types';
import { downloadVoice, voiceUri } from './storage';
import { useStore } from './store';
import { countdownSound, installSounds } from './notifySounds';
import { pack, type Clip } from './voices';

const S = {
  tick: require('../assets/sounds/tick.wav'),
  end: require('../assets/sounds/end.wav'),
  phase: require('../assets/sounds/phase.wav'),
  silence: require('../assets/sounds/silence.wav'),
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
let cap: ReturnType<typeof setTimeout> | null = null;

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

/** Plays once the file is loaded: a clip asked for before it is ready would otherwise stay silent. */
function whenLoaded(p: AudioPlayer, go: () => void) {
  if ((p as any).isLoaded !== false) return go();
  let done = false;
  const once = () => {
    if (done) return;
    done = true;
    sub.remove();
    go();
  };
  const sub = p.addListener('playbackStatusUpdate', (st: any) => st?.isLoaded && once());
  setTimeout(once, 1500);
}

function start(key: string, source: number | string, seconds?: number, full = false) {
  const { sound, volume } = useStore.getState().timer;
  if (!sound || volume <= 0) return;
  try {
    current?.pause();
    const p = player(key, source);
    // Voices are recorded far quieter than the beeps, so they always play at full volume.
    p.volume = full ? 1 : volume;
    current = p;
    if (cap) clearTimeout(cap);
    cap = seconds ? setTimeout(() => current === p && stopCue(), seconds * 1000) : null;
    whenLoaded(p, () => {
      if (current !== p) return;
      p.seekTo(0).then(() => p.play()).catch(() => p.play());
    });
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

// English male iPhone voices, most natural first. The novelty voices (Grandpa, Rocko...) are left out.
const MALE = ['Evan', 'Nathan', 'Aaron', 'Arthur', 'Daniel', 'Tom', 'Alex', 'Oliver', 'Gordon', 'Rishi', 'Fred'];
const isEnglish = (v: Speech.Voice) => /^en[-_]/i.test(v.language);
const maleRank = (v: Speech.Voice) => {
  const i = MALE.findIndex((n) => v.name.startsWith(n));
  return (i < 0 ? 100 : i) - (v.quality === Speech.VoiceQuality.Enhanced ? 50 : 0);
};

let voices: Speech.Voice[] | null = null;
/** The phone's English voices, male ones first (better quality first among them). */
export async function englishVoices() {
  if (!voices?.length) {
    try {
      voices = (await Speech.getAvailableVoicesAsync()).filter(isEnglish).sort((a, b) => maleRank(a) - maleRank(b) || a.name.localeCompare(b.name));
    } catch {
      voices = [];
    }
  }
  return voices;
}

/**
 * The voice to speak with: the one picked in settings, else the best English male voice. Naming the
 * voice matters: asking only for "en-US" can fall back to the phone's own language voice (a French
 * voice reading English).
 */
async function voiceFor() {
  const all = await englishVoices();
  const picked = useStore.getState().timer.voiceId;
  return (all.find((v) => v.identifier === picked) ?? all.find((v) => maleRank(v) < 100) ?? all.find((v) => v.language === 'en-US') ?? all[0])?.identifier;
}
englishVoices();

/**
 * Speaks a short line in an English iPhone voice. Music dips while it talks; a silent clip played
 * afterwards hands the audio session back so the music comes up again.
 */
export function say(text: string) {
  const { sound, volume } = useStore.getState().timer;
  if (!sound || volume <= 0) return;
  buzz('end');
  voiceFor().then((voice) => {
    try {
      Speech.stop();
      Speech.speak(text, { language: 'en-US', voice, rate: 0.95, volume, onDone: () => start('silence', S.silence), onError: () => start('silence', S.silence) });
    } catch {}
  });
}

/** One file holding N ticks and the closing tone; N is rounded down to an available length. */
export function playCountdown(seconds: number, ending: 'end' | 'phase') {
  const n = [15, 10, 5, 3].find((x) => x <= seconds);
  start(n ? `count${n}-${ending}` : ending, n ? S[`count${n}-${ending}` as Sound] : S[ending]);
}

/** Clips of a pack the user kept in rotation (all of them when every clip was removed). */
export function keptClips(cue: Cue) {
  const muted = useStore.getState().timer.muted ?? [];
  const p = pack(cue);
  const kept = p.clips.filter((c) => !muted.includes(c.id));
  return kept.length ? kept : p.clips;
}

function clipSource(cue: Cue, clip: Clip) {
  const local = pack(cue).remote ? voiceUri(clip.id) : null;
  // The key changes once a clip is downloaded, so a player made from the web address is not reused.
  return { key: `${clip.id}:${local ? 'file' : 'src'}`, source: local ?? clip.source };
}

let restoreMix: ReturnType<typeof setTimeout> | null = null;
async function playClipNow(cue: Cue, clip: Clip) {
  const { key, source } = clipSource(cue, clip);
  if (useStore.getState().timer.pauseMusic) {
    // Music pauses for the clip and comes back when the session is released after it.
    try { await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'doNotMix', shouldPlayInBackground: true }); } catch {}
    if (restoreMix) clearTimeout(restoreMix);
    restoreMix = setTimeout(() => {
      setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'duckOthers', shouldPlayInBackground: true }).catch(() => {});
    }, ((clip.seconds ?? 4) + 0.5) * 1000);
  }
  start(key, source, clip.seconds, true);
}

/** Loads the kept clips of a pack ahead of time, so the one picked plays the moment it is due. */
export function preloadVoices(cue: Cue) {
  if (cue === 'beeps') return;
  for (const clip of keptClips(cue)) {
    const { key, source } = clipSource(cue, clip);
    try { player(key, source); } catch {}
  }
}

/** A random kept clip from the chosen voice pack: the downloaded copy when there is one. */
export function playVoice(cue: Cue) {
  const clips = keptClips(cue);
  if (!clips.length) return play('end');
  buzz('end');
  playClipNow(cue, clips[Math.floor(Math.random() * clips.length)]);
}

/** Plays one clip, for listening before keeping or removing it. */
export function playClip(cue: Cue, clipId: string) {
  const clip = pack(cue).clips.find((c) => c.id === clipId);
  if (clip) playClipNow(cue, clip);
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
// Timer notifications are the backstop for a locked phone: in the app the timer beeps itself, so they
// stay silent there. Reminders always show.
Notifications.setNotificationHandler?.({
  handleNotification: async (n) => {
    const timer = (n.request.content.data as any)?.kind === 'timer' && AppState.currentState === 'active';
    return { shouldShowBanner: !timer, shouldShowList: !timer, shouldPlaySound: !timer, shouldSetBadge: false };
  },
});

let scheduled: string | null = null;
/**
 * A notification that sounds the countdown so it ends exactly at `at`: it fires `lead` seconds early
 * (rounded down to a countdown length that exists) with that countdown as its sound.
 */
export async function scheduleEnd(at: number, title: string, body: string, lead = 5, ending: 'end' | 'phase' = 'end') {
  if (Platform.OS === 'web') return;
  await cancelEnd();
  const sound = countdownSound(lead, ending);
  const seconds = Math.round((at - Date.now()) / 1000) - sound.seconds;
  if (seconds < 2) return;
  try {
    await installSounds();
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted && perm.canAskAgain) await Notifications.requestPermissionsAsync();
    scheduled = await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: sound.file, data: { kind: 'timer' }, interruptionLevel: 'timeSensitive' },
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

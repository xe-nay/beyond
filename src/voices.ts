// End-of-rest cues. "Let's go" and "Drill" ship inside the app (CC0 recordings from Freesound).
// The coach packs are downloaded once onto the phone from the web and played from there; they are
// not part of the app or its public repository.
import type { Cue } from './domain/types';

export interface Clip { id: string; name: string; source: number | string; credit: string; seconds?: number } // seconds: played length cap for long clips
export interface Pack { id: Cue; name: string; detail: string; remote: boolean; clips: Clip[] }

const MI = 'https://www.myinstants.com/media/sounds';
const TUNA = 'https://us-tuna-sounds-files.voicemod.net';

export const PACKS: Pack[] = [
  { id: 'beeps', name: 'Beeps', detail: 'Countdown ticks and a closing tone', remote: false, clips: [] },
  {
    id: 'letsgo', name: "Let's go", detail: 'Real voices, built in', remote: false,
    clips: [
      { id: 'letsgo-a', name: "Let's go 1", source: require('../assets/voices/letsgo-a.mp3'), credit: 'duducsepel (CC0)' },
      { id: 'letsgo-b', name: "Let's go 2", source: require('../assets/voices/letsgo-b.mp3'), credit: 'duducsepel (CC0)' },
      { id: 'letsgo-c', name: "Let's go 3", source: require('../assets/voices/letsgo-c.mp3'), credit: 'Sadiquecat (CC0)' },
      { id: 'letsgo-d', name: "Let's go 4", source: require('../assets/voices/letsgo-d.mp3'), credit: 'dastudiospr (CC0)' },
      { id: 'whoot', name: "Whoo", source: require('../assets/voices/whoot.mp3'), credit: 'Sadiquecat (CC0)' },
    ],
  },
  {
    id: 'drill', name: 'Drill sergeant', detail: 'Shouted orders, built in', remote: false,
    clips: [
      { id: 'drill', name: "Move it", source: require('../assets/voices/drill.mp3'), credit: 'qubodup (CC0)' },
      { id: 'readysetgo', name: "Ready, set, go", source: require('../assets/voices/readysetgo.mp3'), credit: 'dastudiospr (CC0)' },
    ],
  },
  {
    id: 'goggins', name: 'David Goggins', detail: 'Stay hard · downloaded once', remote: true,
    clips: [
      { id: 'goggins-stay-hard', name: "Stay hard", source: `${MI}/david-goggins-stay-hard.mp3`, credit: 'David Goggins' },
      { id: 'goggins-stay-hard-2', name: "Stay hard 2", source: `${MI}/stay-f-ing-hard-david-goggins.mp3`, credit: 'David Goggins' },
      { id: 'goggins-dont-know-me', name: "They don't know me", source: `${MI}/david-goggins-they-dont-know-me-son_zw1H5ON.mp3`, credit: 'David Goggins' },
      { id: 'goggins-work', name: "Let's get to work", source: `${MI}/letsgettoworkgoggins.mp3`, credit: 'David Goggins' },
      { id: 'goggins-savage', name: "What a savage", source: `${MI}/david-goggins-what-a-savage.mp3`, credit: 'David Goggins' },
    ],
  },
  {
    id: 'ronnie', name: 'Ronnie Coleman', detail: 'Yeah buddy · downloaded once', remote: true,
    clips: [
      { id: 'ronnie-yeah-buddy', name: "Yeah buddy", source: `${MI}/yeahbuddy.mp3`, credit: 'Ronnie Coleman' },
      { id: 'ronnie-lightweight', name: "Lightweight baby", source: `${MI}/ronnie_lightweight-baby.mp3`, credit: 'Ronnie Coleman' },
      { id: 'ronnie-yeah-lightweight', name: "Yeah, lightweight", source: `${MI}/yeah-light-weight-baby.mp3`, credit: 'Ronnie Coleman' },
    ],
  },
  {
    id: 'sulek', name: 'Sam Sulek', detail: 'Intro clip · downloaded once', remote: true,
    clips: [
      { id: 'sulek-intro', name: 'Intro', source: `${TUNA}/c2142fd9-ab0f-4556-956c-b3be37e3c6b1-1693439831755.mp3`, credit: 'Sam Sulek', seconds: 5 },
    ],
  },
];

export const pack = (id: Cue) => PACKS.find((p) => p.id === id) ?? PACKS[0];
/** Voices start this many seconds before the rest ends. */
export const VOICE_LEAD = 3;

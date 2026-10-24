// End-of-rest cues. "Let's go" and "Drill" ship inside the app (CC0 recordings from Freesound).
// The coach packs are downloaded once onto the phone from the web and played from there; they are
// not part of the app or its public repository.
import type { Cue } from './domain/types';

export interface Clip { id: string; source: number | string; credit: string }
export interface Pack { id: Cue; name: string; detail: string; remote: boolean; clips: Clip[] }

const MI = 'https://www.myinstants.com/media/sounds';

export const PACKS: Pack[] = [
  { id: 'beeps', name: 'Beeps', detail: 'Countdown ticks and a closing tone', remote: false, clips: [] },
  {
    id: 'letsgo', name: "Let's go", detail: 'Real voices, built in', remote: false,
    clips: [
      { id: 'letsgo-a', source: require('../assets/voices/letsgo-a.mp3'), credit: 'duducsepel (CC0)' },
      { id: 'letsgo-b', source: require('../assets/voices/letsgo-b.mp3'), credit: 'duducsepel (CC0)' },
      { id: 'letsgo-c', source: require('../assets/voices/letsgo-c.mp3'), credit: 'Sadiquecat (CC0)' },
      { id: 'letsgo-d', source: require('../assets/voices/letsgo-d.mp3'), credit: 'dastudiospr (CC0)' },
      { id: 'whoot', source: require('../assets/voices/whoot.mp3'), credit: 'Sadiquecat (CC0)' },
    ],
  },
  {
    id: 'drill', name: 'Drill sergeant', detail: 'Shouted orders, built in', remote: false,
    clips: [
      { id: 'drill', source: require('../assets/voices/drill.mp3'), credit: 'qubodup (CC0)' },
      { id: 'readysetgo', source: require('../assets/voices/readysetgo.mp3'), credit: 'dastudiospr (CC0)' },
    ],
  },
  {
    id: 'goggins', name: 'David Goggins', detail: 'Stay hard · downloaded once', remote: true,
    clips: [
      { id: 'goggins-stay-hard', source: `${MI}/david-goggins-stay-hard.mp3`, credit: 'David Goggins' },
      { id: 'goggins-stay-hard-2', source: `${MI}/stay-f-ing-hard-david-goggins.mp3`, credit: 'David Goggins' },
      { id: 'goggins-dont-know-me', source: `${MI}/david-goggins-they-dont-know-me-son_zw1H5ON.mp3`, credit: 'David Goggins' },
      { id: 'goggins-work', source: `${MI}/letsgettoworkgoggins.mp3`, credit: 'David Goggins' },
      { id: 'goggins-savage', source: `${MI}/david-goggins-what-a-savage.mp3`, credit: 'David Goggins' },
    ],
  },
  {
    id: 'ronnie', name: 'Ronnie Coleman', detail: 'Yeah buddy · downloaded once', remote: true,
    clips: [
      { id: 'ronnie-yeah-buddy', source: `${MI}/yeahbuddy.mp3`, credit: 'Ronnie Coleman' },
      { id: 'ronnie-lightweight', source: `${MI}/ronnie_lightweight-baby.mp3`, credit: 'Ronnie Coleman' },
      { id: 'ronnie-yeah-lightweight', source: `${MI}/yeah-light-weight-baby.mp3`, credit: 'Ronnie Coleman' },
    ],
  },
];

export const pack = (id: Cue) => PACKS.find((p) => p.id === id) ?? PACKS[0];
/** Voices start this many seconds before the rest ends. */
export const VOICE_LEAD = 3;

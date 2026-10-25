// Notification sounds. iOS plays a custom notification sound only from the app bundle or the app's
// Library/Sounds folder, as uncompressed audio; the beeps are copied there once at launch. A rest or
// phase notification is then scheduled N seconds early with the N-second countdown as its sound, so
// the countdown is heard on time even with the phone locked.
import { Asset } from 'expo-asset';
import { Directory, File, Paths } from 'expo-file-system';

const FILES: Record<string, number> = {
  'beyond-beep.wav': require('../assets/sounds/notify/beyond-beep.wav'),
  'beyond-count3-end.wav': require('../assets/sounds/notify/beyond-count3-end.wav'),
  'beyond-count5-end.wav': require('../assets/sounds/notify/beyond-count5-end.wav'),
  'beyond-count10-end.wav': require('../assets/sounds/notify/beyond-count10-end.wav'),
  'beyond-count15-end.wav': require('../assets/sounds/notify/beyond-count15-end.wav'),
  'beyond-count3-phase.wav': require('../assets/sounds/notify/beyond-count3-phase.wav'),
  'beyond-count5-phase.wav': require('../assets/sounds/notify/beyond-count5-phase.wav'),
  'beyond-count10-phase.wav': require('../assets/sounds/notify/beyond-count10-phase.wav'),
  'beyond-count15-phase.wav': require('../assets/sounds/notify/beyond-count15-phase.wav'),
};

let installed = false;
export async function installSounds() {
  if (installed) return;
  installed = true;
  try {
    const dir = new Directory(Paths.cache.parentDirectory, 'Sounds'); // Library/Sounds
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    for (const [name, mod] of Object.entries(FILES)) {
      const dest = new File(dir, name);
      if (dest.exists) continue;
      const asset = await Asset.fromModule(mod).downloadAsync();
      if (asset.localUri) new File(asset.localUri).copy(dest);
    }
  } catch {
    installed = false;
  }
}

/** The countdown that fits in `lead` seconds: its file and length, or the single beep. */
export function countdownSound(lead: number, ending: 'end' | 'phase') {
  const n = [15, 10, 5, 3].find((x) => x <= lead);
  return n ? { file: `beyond-count${n}-${ending}.wav`, seconds: n } : { file: 'beyond-beep.wav', seconds: 0 };
}

export const BEEP = 'beyond-beep.wav';

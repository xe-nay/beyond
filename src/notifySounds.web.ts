// The browser preview has no notification sounds.
export async function installSounds() {}
export function countdownSound(lead: number, ending: 'end' | 'phase') {
  const n = [15, 10, 5, 3].find((x) => x <= lead);
  return n ? { file: `beyond-count${n}-${ending}.wav`, seconds: n } : { file: 'beyond-beep.wav', seconds: 0 };
}
export const BEEP = 'beyond-beep.wav';

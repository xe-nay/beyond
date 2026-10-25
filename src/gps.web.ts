// The browser preview has no tracking; distance is entered at the end.
import type { Sample } from './domain/track';

export async function startGps(_activity: string, _carried = 0) {
  return 'off' as const;
}
export function pauseGps(_paused: boolean) {}
export async function stopGps() {}
export const gps = () => ({ meters: 0, samples: [] as Sample[], mode: 'off' as const });

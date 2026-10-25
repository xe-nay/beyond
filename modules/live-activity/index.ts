// The live session on the Lock Screen and in the Dynamic Island (iOS 16.2+). Missing elsewhere: every
// call then does nothing. The last failure is kept so the app can show why nothing appears.
import { requireOptionalNativeModule } from 'expo-modules-core';

export interface LiveState {
  mode: 'lift' | 'rest' | 'cardio' | 'paused';
  title: string;
  subtitle: string;
  symbol: string;
  accent: string;
  startedAt?: number | null;
  endsAt?: number | null;
  total: number;
}

const native = requireOptionalNativeModule<{
  isAvailable(): boolean;
  log(message: string): void;
  status(): { supported: boolean; enabled: boolean; running: number };
  start(name: string, state: LiveState): Promise<string | null>;
  update(state: LiveState): Promise<void>;
  end(): Promise<void>;
}>('LiveActivity');

let lastError: string | null = null;
/** Writes to the device log (category BeyondLive), readable over USB. */
export const liveLog = (message: string) => { try { native?.log(message); } catch {} };
const fail = (e: any) => {
  lastError = String(e?.message ?? e);
  liveLog(`failed: ${lastError}`);
  return null;
};

export const liveAvailable = () => { try { return !!native?.isAvailable(); } catch { return false; } };
export const startLive = (name: string, state: LiveState) =>
  native ? native.start(name, state).then((id) => { lastError = null; return id; }).catch(fail) : Promise.resolve(null);
export const updateLive = (state: LiveState) => native?.update(state).catch(fail) ?? Promise.resolve();
export const endLive = () => native?.end().catch(fail) ?? Promise.resolve();

/** Why the island may stay empty: not built in, turned off in Settings, or the last error from iOS. */
export function liveStatus() {
  if (!native) {
    // Which native modules the app does see, to tell a missing registration from a broken bridge.
    const seen = Object.keys((globalThis as any).expo?.modules ?? {});
    return { ok: false, text: `Not in this build (app sees ${seen.length} modules${seen.length ? `: ${seen.filter((n) => /live|activ|audio|location/i.test(n)).join(', ') || seen.slice(0, 4).join(', ')}` : ''})` };
  }
  try {
    const st = native.status();
    if (!st.supported) return { ok: false, text: 'Needs iOS 16.2 or later' };
    if (!st.enabled) return { ok: false, text: 'Turned off: Settings › Beyond › Live Activities' };
    if (lastError) return { ok: false, text: lastError };
    return { ok: true, text: st.running ? 'Showing now' : 'Ready' };
  } catch (e: any) {
    return { ok: false, text: String(e?.message ?? e) };
  }
}

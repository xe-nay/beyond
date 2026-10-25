// The live session on the Lock Screen and in the Dynamic Island (iOS 16.2+). Missing elsewhere: every
// call then does nothing.
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
  start(name: string, state: LiveState): Promise<string | null>;
  update(state: LiveState): Promise<void>;
  end(): Promise<void>;
}>('LiveActivity');

export const liveAvailable = () => { try { return !!native?.isAvailable(); } catch { return false; } };
export const startLive = (name: string, state: LiveState) => native?.start(name, state).catch(() => null) ?? Promise.resolve(null);
export const updateLive = (state: LiveState) => native?.update(state).catch(() => {}) ?? Promise.resolve();
export const endLive = () => native?.end().catch(() => {}) ?? Promise.resolve();

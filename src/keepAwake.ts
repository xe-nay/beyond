import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect } from 'react';

/** Keeps the screen on while mounted. Failures (e.g. a browser refusing) are ignored, never thrown. */
export function useScreenOn(tag: string) {
  useEffect(() => {
    let active = false;
    activateKeepAwakeAsync(tag).then(() => (active = true)).catch(() => {});
    return () => {
      if (active) Promise.resolve(deactivateKeepAwake(tag)).catch(() => {});
    };
  }, [tag]);
}

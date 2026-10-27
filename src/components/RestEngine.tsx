// Drives the rest countdown wherever the user is in the app, and with the phone locked while the app is
// kept awake (keepAlive.ts). The last seconds always beep; in voice mode the chosen clip plays when the
// rest is over. A notification is sent only when the app could not be kept awake.
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { exercise } from '../catalog';
import { awake, buzz, cancelEnd, playCountdown, playVoice, preloadVoices, scheduleEnd, stopCue } from '../sound';
import { useStore } from '../store';

export function RestEngine() {
  const rest = useStore((s) => s.rest);
  const { countdown, cue } = useStore((s) => s.timer);
  const fired = useRef(false);
  const last = useRef<number | null>(null);
  const ended = useRef(false);

  useEffect(() => {
    fired.current = false;
    last.current = null;
    if (!rest.endsAt) {
      // A pause or skip cuts the cue; a natural end lets the closing sound finish.
      if (!ended.current) stopCue();
      ended.current = false;
      cancelEnd();
      return;
    }
    const name = rest.exerciseId ? exercise(rest.exerciseId)?.name : null;
    if (!awake()) scheduleEnd(rest.endsAt, 'Rest over', name ? `Next set: ${name}` : 'Time for the next set', countdown, 'end');
    preloadVoices(cue);
    const voice = cue !== 'beeps';
    const tick = () => {
      const remaining = (rest.endsAt! - Date.now()) / 1000;
      const whole = Math.ceil(remaining - 1e-6);
      const shown = AppState.currentState === 'active';
      // Sounds play in front and, while the app is kept awake, behind the lock screen too.
      const audible = shown || awake();
      // The countdown beeps start once, N seconds before the end (or right away if the rest is shorter).
      if (!fired.current && remaining <= countdown + 0.05 && remaining > 0.3) {
        fired.current = true;
        if (audible && countdown > 0) playCountdown(Math.max(0, Math.min(countdown, Math.round(remaining))), voice ? 'phase' : 'end');
      }
      // A light tap each final second, so the countdown can be felt as well as heard.
      if (whole !== last.current && whole > 0 && whole <= countdown && shown) buzz('tick');
      last.current = whole;
      if (remaining <= 0) {
        // Over: the chosen voice, or (with no countdown) the closing tone.
        if (audible && remaining > -1.5) {
          if (voice) playVoice(cue);
          else if (!fired.current || countdown === 0) playCountdown(0, 'end');
        }
        if (shown) buzz('end');
        ended.current = true;
        cancelEnd();
        useStore.getState().stopRest();
      }
    };
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [rest.endsAt, countdown, cue]);

  return null;
}

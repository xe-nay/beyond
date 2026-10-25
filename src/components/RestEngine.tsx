// Drives the rest countdown wherever the user is in the app. Beeps mode: one countdown file
// starting N seconds before the end. Voice mode: a clip 3 seconds before the end. A scheduled
// notification is the backstop when the phone is locked.
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { exercise } from '../catalog';
import { buzz, cancelEnd, playCountdown, playVoice, preloadVoices, scheduleEnd, stopCue } from '../sound';
import { useStore } from '../store';
import { VOICE_LEAD } from '../voices';

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
    scheduleEnd(rest.endsAt, 'Rest over', name ? `Next set: ${name}` : 'Time for the next set', cue === 'beeps' ? countdown : VOICE_LEAD, 'end');
    preloadVoices(cue);
    const lead = cue === 'beeps' ? countdown : VOICE_LEAD;
    const tick = () => {
      const remaining = (rest.endsAt! - Date.now()) / 1000;
      const whole = Math.ceil(remaining - 1e-6);
      const active = AppState.currentState === 'active';
      // Start the cue once, at the lead time (or right away if the rest is already shorter).
      if (!fired.current && remaining <= lead + 0.05 && remaining > 0.3) {
        fired.current = true;
        if (active) {
          if (cue === 'beeps') playCountdown(Math.max(0, Math.min(lead, Math.round(remaining))), 'end');
          else playVoice(cue);
        }
      }
      // A light tap each final second, so the countdown can be felt as well as heard.
      if (cue === 'beeps' && whole !== last.current && whole > 0 && whole <= countdown && active) buzz('tick');
      last.current = whole;
      if (remaining <= 0) {
        if (!fired.current && active && remaining > -1.5) cue === 'beeps' ? playCountdown(0, 'end') : playVoice(cue);
        if (active) buzz('end');
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

// Ready-made guided cardio sessions: chips in the cardio editor, and choices when planning a day.
import type { IntervalPlan } from './domain/types';

export const PRESETS: { name: string; plan: IntervalPlan }[] = [
  { name: 'Intervals 6 × 1′', plan: { activity: 'Running', warmupSeconds: 300, workSeconds: 60, recoverySeconds: 90, rounds: 6, cooldownSeconds: 300, workCue: 'Hard', recoveryCue: 'Easy jog', countdown: 5, workPace: { fast: 260, slow: 280 }, recoveryPace: { fast: 390, slow: 450 } } },
  { name: 'Tempo 20′', plan: { activity: 'Running', warmupSeconds: 600, workSeconds: 1200, recoverySeconds: 0, rounds: 1, cooldownSeconds: 300, workCue: 'Tempo', recoveryCue: '', countdown: 10, workPace: { fast: 290, slow: 310 } } },
  { name: 'Run/walk 6 × 90″', plan: { activity: 'Running', warmupSeconds: 300, workSeconds: 90, recoverySeconds: 120, rounds: 6, cooldownSeconds: 300, workCue: 'Easy', recoveryCue: 'Walk', warmupCue: 'Brisk walk', cooldownCue: 'Walk', countdown: 5, workPace: { fast: 435, slow: 495 }, recoveryPace: { fast: 600, slow: 720 } } },
  { name: 'HIIT 30/30', plan: { activity: 'HIIT', warmupSeconds: 180, workSeconds: 30, recoverySeconds: 30, rounds: 10, cooldownSeconds: 120, workCue: 'All out', recoveryCue: 'Rest', countdown: 3 } },
  { name: 'Row 4 × 2′', plan: { activity: 'Rowing', warmupSeconds: 300, workSeconds: 120, recoverySeconds: 120, rounds: 4, cooldownSeconds: 180, workCue: 'Hard', recoveryCue: 'Light pace', countdown: 5 } },
  { name: 'Zone 2 · 40′', plan: { activity: 'Cycling', warmupSeconds: 0, workSeconds: 2400, recoverySeconds: 0, rounds: 1, cooldownSeconds: 0, workCue: 'Steady', recoveryCue: '', countdown: 10 } },
  {
    name: 'Treadmill hills', plan: {
      activity: 'Walking', machine: 'treadmill', warmupSeconds: 300, workSeconds: 1800, recoverySeconds: 0, rounds: 1, cooldownSeconds: 300, workCue: '', recoveryCue: '', warmupCue: 'Easy walk', cooldownCue: 'Walk', countdown: 10,
      warmupSettings: { speedKmh: { lo: 5, hi: 5 }, inclinePct: { lo: 1, hi: 1 } }, cooldownSettings: { speedKmh: { lo: 4.5, hi: 4.5 }, inclinePct: { lo: 0, hi: 0 } },
      segments: [
        { seconds: 600, cue: 'Hill', settings: { speedKmh: { lo: 5.5, hi: 5.5 }, inclinePct: { lo: 6, hi: 6 } } },
        { seconds: 600, cue: 'Steeper', settings: { speedKmh: { lo: 5, hi: 5 }, inclinePct: { lo: 10, hi: 10 } } },
        { seconds: 600, cue: 'Steepest', settings: { speedKmh: { lo: 4.8, hi: 4.8 }, inclinePct: { lo: 12, hi: 12 } } },
      ],
    },
  },
];

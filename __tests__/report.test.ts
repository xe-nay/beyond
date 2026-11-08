/// <reference types="jest" />
// The export end to end, from a realistic month of data: every section, page breaks, and nothing broken
// (no NaN, undefined or empty pages) in the HTML expo-print turns into the PDF.
import { buildReport, reportHtml, reportText } from '../src/report';
import { useStore } from '../src/store';

const day = (n: number) => new Date(Date.UTC(2026, 9, 1 + n, 12)).toISOString().slice(0, 10);
const set = (exerciseId: string, reps: number, loadKg: number, rir: number | null, extra: object = {}) => ({
  id: Math.random().toString(36), exerciseId, reps, loadKg, rir, warmup: false, completedAt: '2026-10-01T10:00:00Z', restSeconds: 120, ...extra,
});

test('the PDF export carries the progress stats and renders cleanly', () => {
  useStore.getState().reset();
  const sessions = Array.from({ length: 8 }, (_, i) => ({
    id: `s${i}`, programId: null, dayId: null, name: i % 2 ? 'Lower' : 'Upper', date: day(i * 3), plan: [],
    sets: [
      set('lat-pulldown', 6, 40, null, { warmup: true }),
      set('lat-pulldown', 10, 50 + i * 2.5, 2, { attachment: 'neutral-medium' }),
      set('lat-pulldown', 9, 50 + i * 2.5, 1),
      set('seated-cable-row', 12, 45 + i, 2),
      set('f-one-arm-dumbbell-row', 10, 20, 2, { sides: { l: { kg: 20, reps: 10 }, r: { kg: 20, reps: 9 } } }),
    ],
    startedAt: `${day(i * 3)}T09:00:00Z`, finishedAt: `${day(i * 3)}T10:05:00Z`, sessionRpe: 7, notes: '',
  }));
  useStore.getState().set({
    ready: true,
    sessions,
    cardio: [
      { id: 'c1', date: day(2), activity: 'Running', minutes: 28, distanceKm: 5, rpe: 8, avgHr: 160, plan: null, completed: true, notes: '' },
      { id: 'c2', date: day(9), activity: 'Walking', minutes: 45, distanceKm: 4, rpe: 3, avgHr: null, plan: null, completed: true, notes: '' },
    ],
    body: [
      { id: 'b1', date: day(0), weightKg: 80, waistCm: 84, chestCm: null, armCm: null, thighCm: null, photo: null },
      { id: 'b2', date: day(20), weightKg: 78.6, waistCm: 82, chestCm: null, armCm: null, thighCm: null, photo: null },
    ],
  } as any);

  const pages = buildReport(useStore.getState(), day(0), day(25));
  const html = reportHtml(pages);
  const text = reportText(pages);

  for (const section of ['Summary', 'Progress', 'Strength', 'Sets per muscle', 'Weekly volume', 'Effort and recovery', 'Cardio fitness', 'Body weight', 'Workouts', 'Cardio', 'Body']) {
    expect(text.toLowerCase()).toContain(section.toLowerCase());
  }
  // Strength from first to latest: 50 → 67.5 kg × 10 on the pulldown is an e1RM gain.
  expect(text).toMatch(/Lat Pulldown \| \d+ \| [\d.]+ kg \| [\d.]+ kg \| \+/);
  expect(text).toContain('VDOT');
  expect(text).toContain('80 kg → 78.6 kg | -1.4 kg | -1.8%');
  // Nothing broken anywhere.
  expect(html).not.toMatch(/NaN|undefined|Infinity|\[object/);
  expect(pages.length).toBeGreaterThan(1);
  for (const p of pages) expect(p.lines.length).toBeGreaterThan(0);
  expect((html.match(/<section class="page">/g) ?? []).length).toBe(pages.length);
  expect(html).toContain(`page ${pages.length} of ${pages.length}`);
});

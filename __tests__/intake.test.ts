/// <reference types="jest" />
// The daily intake reminder: which time it shows, and answers given on it while the app was closed.
import { takeIntakeAnswers } from '../modules/live-activity';
import type { Supplement } from '../src/domain/types';
import { liveSlots, upcomingSlots } from '../src/intakeLive';
import { today, useStore } from '../src/store';

const supp = (id: string, time: string): Supplement => ({
  id, name: id, brand: null, image: null, barcode: null, dose: 5, unit: 'g', time, per100: null, servingG: null, micros: [], createdAt: '2026-01-01T00:00:00Z',
});

test('every time in the next 24 hours gets its own reminder; answered times drop out', () => {
  const s = { supplements: [supp('creatine', '08:00'), supp('multi', '08:10'), supp('omega', '20:00')], intakes: [], skipped: [] };
  const now = new Date(2026, 9, 27, 7, 0);
  const slots = upcomingSlots(s, now);
  // Today 08:00, 08:10 and 20:00 (each its own, though close together), tomorrow 07:00 is past the 24 h.
  expect(slots.map((x) => x.time)).toEqual(['08:00', '08:10', '20:00']);
  expect(slots[0].items).toEqual(['creatine · 5 g']);
  // In the evening, tomorrow's times (up to 24 hours ahead) are planned too.
  expect(upcomingSlots(s, new Date(2026, 9, 27, 21, 0)).map((x) => `${x.date} ${x.time}`)).toEqual([
    `${today(now)} 08:00`, `${today(now)} 08:10`, `${today(now)} 20:00`,
    `${today(new Date(2026, 9, 28, 12))} 08:00`, `${today(new Date(2026, 9, 28, 12))} 08:10`, `${today(new Date(2026, 9, 28, 12))} 20:00`,
  ]);
  const answered = { ...s, skipped: [{ supplementId: 'creatine', date: today(now) }] };
  expect(upcomingSlots(answered, now).map((x) => x.time)).toEqual(['08:10', '20:00']);
});

test('Taken pressed on the reminder while the app was closed is applied when it starts', () => {
  useStore.getState().reset();
  useStore.getState().set({ ready: true, supplements: [supp('creatine', '08:00')] } as any);
  const date = today();
  (takeIntakeAnswers as jest.Mock).mockReturnValueOnce([{ date, time: '08:00', answer: 'taken' }]);
  // What the app does on starting: take the saved answers and apply them.
  const { answerSlot } = require('../src/intakeActions');
  for (const a of takeIntakeAnswers()) answerSlot(a.date, a.time, a.answer);
  expect(useStore.getState().intakes.map((i) => i.supplementId)).toEqual(['creatine']);
});

test('at most two intake reminders are live: the latest one due and the next one', () => {
  const at = (h: number) => ({ dueAt: new Date(2026, 9, 27, h).getTime(), h });
  const now = new Date(2026, 9, 27, 13).getTime();
  // 08:00 and 12:00 are due, 18:00 and 22:00 coming: 12:00 and 18:00 stay live, the rest are notifications.
  expect(liveSlots([at(22), at(8), at(18), at(12)], now).map((x) => x.h)).toEqual([12, 18]);
  // Nothing due yet: the next two.
  expect(liveSlots([at(18), at(22), at(23)], now).map((x) => x.h)).toEqual([18, 22]);
});

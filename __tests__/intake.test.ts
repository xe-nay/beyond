/// <reference types="jest" />
// The daily intake reminder: which time it shows, and answers given on it while the app was closed.
import { takeIntakeAnswers } from '../modules/live-activity';
import type { Supplement } from '../src/domain/types';
import { nextSlot } from '../src/intakeLive';
import { today, useStore } from '../src/store';

const supp = (id: string, time: string): Supplement => ({
  id, name: id, brand: null, image: null, barcode: null, dose: 5, unit: 'g', time, per100: null, servingG: null, micros: [], createdAt: '2026-01-01T00:00:00Z',
});

test('the reminder shows the first unanswered time, if within 8 hours', () => {
  const now = new Date(2026, 9, 27, 7, 0);
  const s = { supplements: [supp('creatine', '08:00'), supp('multi', '20:00')], intakes: [], skipped: [] };
  expect(nextSlot(s, now)?.time).toBe('08:00');
  expect(nextSlot(s, now)?.items).toEqual(['creatine · 5 g']);
  const answered = { ...s, skipped: [{ supplementId: 'creatine', date: today(now) }] };
  expect(nextSlot(answered, now)).toBeNull(); // 20:00 is 13 h away: too far for a Live Activity
  expect(nextSlot(answered, new Date(2026, 9, 27, 13, 0))?.time).toBe('20:00');
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

/// <reference types="jest" />
// The daily intake reminder: which time it shows, and answers given on it while the app was closed.
import { takeIntakeAnswers } from '../modules/live-activity';
import type { Supplement } from '../src/domain/types';
import { nextSlot } from '../src/intakeLive';
import { today, useStore } from '../src/store';

const supp = (id: string, time: string): Supplement => ({
  id, name: id, brand: null, image: null, barcode: null, dose: 5, unit: 'g', time, per100: null, servingG: null, micros: [], createdAt: '2026-01-01T00:00:00Z',
});

test('the reminder shows 15 minutes before its time, and stays until answered', () => {
  const s = { supplements: [supp('creatine', '08:00'), supp('multi', '20:00')], intakes: [], skipped: [] };
  expect(nextSlot(s, new Date(2026, 9, 27, 7, 0))).toBeNull(); // an hour early: not yet
  expect(nextSlot(s, new Date(2026, 9, 27, 7, 45))?.time).toBe('08:00');
  expect(nextSlot(s, new Date(2026, 9, 27, 7, 45))?.items).toEqual(['creatine · 5 g']);
  expect(nextSlot(s, new Date(2026, 9, 27, 9, 30))?.time).toBe('08:00'); // due and unanswered
  const answered = { ...s, skipped: [{ supplementId: 'creatine', date: today(new Date(2026, 9, 27, 7, 0)) }] };
  expect(nextSlot(answered, new Date(2026, 9, 27, 13, 0))).toBeNull();
  expect(nextSlot(answered, new Date(2026, 9, 27, 19, 50))?.time).toBe('20:00');
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

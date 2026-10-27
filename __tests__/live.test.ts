/// <reference types="jest" />
// The Lock Screen / Dynamic Island follows the workout: what it is sent, in what order.
import { startLive, updateLive } from '../modules/live-activity';
import '../src/live';
import { today, useStore } from '../src/store';

const flush = () => new Promise((r) => setTimeout(r, 50));

beforeEach(() => {
  jest.clearAllMocks();
  useStore.getState().reset();
});

test('logging the last set then resting ends on the rest, even when updates are slow', async () => {
  // Every native update takes a while, as it does on the phone.
  (updateLive as jest.Mock).mockImplementation(() => new Promise((r) => setTimeout(r, 30)));
  const s = useStore.getState();
  s.set({ ready: true } as any);
  const id = s.startSession({ empty: true });
  await flush();
  expect(startLive).toHaveBeenCalled();
  useStore.getState().logSet(id, { exerciseId: 'bench-press', loadKg: 60, reps: 8, rir: 2, warmup: false });
  useStore.getState().startRest(150, 'bench-press', id);
  await flush();
  await flush();
  const calls = (updateLive as jest.Mock).mock.calls;
  expect(calls[calls.length - 1][0].mode).toBe('rest');
  // The rest goes stale at its end, so the island can show "rest over" without another update.
  expect(calls[calls.length - 1][0].staleAt).toBe(useStore.getState().rest.endsAt);
  expect(today()).toMatch(/\d{4}-\d{2}-\d{2}/);
});

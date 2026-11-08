// Timers a test leaves behind (the store's save, the reminder and intake refreshes, all debounced)
// would otherwise fire after Jest has torn the environment down ("import after the environment has
// been torn down") and keep the worker from exiting. Each one is tracked and cleared after its test.
const pending = new Set<ReturnType<typeof setTimeout>>();
const realSet = global.setTimeout;
const realClear = global.clearTimeout;
global.setTimeout = ((fn: (...a: unknown[]) => void, ms?: number, ...args: unknown[]) => {
  const handle = realSet(() => {
    pending.delete(handle);
    fn(...args);
  }, ms);
  pending.add(handle);
  return handle;
}) as typeof setTimeout;
global.clearTimeout = ((handle?: ReturnType<typeof setTimeout>) => {
  if (handle) pending.delete(handle);
  realClear(handle);
}) as typeof clearTimeout;

afterEach(() => {
  pending.forEach((h) => realClear(h));
  pending.clear();
});

// Daily intake reminders. iOS keeps at most 64 pending notifications, so instead of open-ended repeats
// the next two weeks are planned one by one and rebuilt whenever supplements or ticks change and each
// time the app opens. That also lets a day be skipped once everything due at that time is ticked.
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { AppState } from 'react-native';

import { BEEP, installSounds } from './notifySounds';
import { reminderPlan, type Reminder } from './domain/supplements';
import type { FoodEntry } from './domain/types';
import { useStore } from './store';

const CATEGORY = 'intake';
let timer: ReturnType<typeof setTimeout> | null = null;

async function replan() {
  const { supplements, intakes, entries, ready } = useStore.getState();
  if (!ready) return;
  try {
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(pending.filter((n) => /^(intake|meal)-/.test(n.identifier)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
    const plan = [...reminderPlan(supplements, intakes, new Date()), ...mealPlan(entries, new Date())];
    if (!plan.length) return;
    await installSounds();
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted && !(perm.canAskAgain && (await Notifications.requestPermissionsAsync()).granted)) return;
    for (const r of plan) {
      await Notifications.scheduleNotificationAsync({
        identifier: r.id,
        content: { title: r.title, body: r.body, sound: BEEP, categoryIdentifier: r.id.startsWith('intake-') ? CATEGORY : undefined, data: { intake: r.id } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at },
      });
    }
  } catch {}
}

/** Planned meals in the next two weeks, one reminder per meal time. */
function mealPlan(entries: FoodEntry[], now: Date): Reminder[] {
  const ahead = new Date(now.getTime() + 14 * 86400000);
  const slots = new Map<string, FoodEntry[]>();
  for (const e of entries) {
    if (!e.time) continue;
    const at = new Date(`${e.date}T${e.time}:00`);
    if (at <= now || at > ahead) continue;
    const key = `${e.date} ${e.time}`;
    slots.set(key, [...(slots.get(key) ?? []), e]);
  }
  return [...slots].slice(0, 20).map(([key, list]) => ({
    id: `meal-${key.replace(/[^0-9]/g, '')}`,
    at: new Date(`${list[0].date}T${list[0].time}:00`),
    title: 'Planned meal',
    body: list.map((e) => `${e.name} · ${Math.round(e.amount)} ${e.basis}`).join('\n'),
  }));
}

const soon = () => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(replan, 800);
};

Notifications.setNotificationCategoryAsync(CATEGORY, [
  { identifier: 'taken', buttonTitle: 'Mark as taken', options: { opensAppToForeground: true } },
]).catch(() => {});

// "Mark as taken" ticks everything due at that time; a plain tap opens Food, where the list is.
Notifications.addNotificationResponseReceivedListener((res) => {
  const id = res.notification.request.identifier;
  if (id.startsWith('meal-')) return void setTimeout(() => router.navigate('/(tabs)/food'), 300);
  if (!id.startsWith('intake-')) return;
  if (res.actionIdentifier === 'taken') {
    const [, y, mo, d, hm] = id.split('-');
    const date = `${y}-${mo}-${d}`;
    const time = `${hm.slice(0, 2)}:${hm.slice(2)}`;
    const s = useStore.getState();
    for (const x of s.supplements) {
      if (x.time === time && !s.intakes.some((i) => i.supplementId === x.id && i.date === date)) useStore.getState().toggleIntake(x.id, date);
    }
  } else {
    setTimeout(() => router.navigate('/(tabs)/food'), 300);
  }
});

useStore.subscribe((s, prev) => {
  if (s.ready && (s.supplements !== prev.supplements || s.intakes !== prev.intakes || s.entries !== prev.entries || s.ready !== prev.ready)) soon();
});
AppState.addEventListener('change', (state) => state === 'active' && soon());


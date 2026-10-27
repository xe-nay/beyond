// Daily intake and supplement reminders. iOS keeps at most 64 pending notifications, so instead of
// open-ended repeats the next days are planned one by one and rebuilt whenever supplements or answers
// change and each time the app opens.
//
// An intake reminder has Taken and Skip buttons that answer it without opening the app, and comes back
// every so often until one is pressed (or the dose is ticked in the app). A pack about to run out gets
// one plain "buy it again" notification, also kept in the app's notification panel.
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { AppState } from 'react-native';

import { BEEP, installSounds } from './notifySounds';
import { answered, daysLeft, formatAmount, reminderPlan, restockAt, stockLeft, type Reminder } from './domain/supplements';
import { intakeSlot } from '../modules/live-activity';
import { answerSlot } from './intakeActions';
import type { FoodEntry, InboxItem } from './domain/types';
import { uid, useStore } from './store';

const CATEGORY = 'intake';
/** Minutes after the reminder time that it comes back while unanswered. */
const NAGS = [15, 30, 60, 90, 120, 180];
let timer: ReturnType<typeof setTimeout> | null = null;

/** The date and "HH:MM" an intake reminder is for, from its id ("intake-2026-10-26-0800-n2"). */
function slot(id: string) {
  const [, y, mo, d, hm] = id.split('-');
  return { date: `${y}-${mo}-${d}`, time: `${hm.slice(0, 2)}:${hm.slice(2)}` };
}

/**
 * Buy reminders: one per pack, at 10:00 on the day three days of doses are left. A pack that reaches
 * that point is also written to the notification panel. When it is already that low as it is set, the
 * notification goes out now; when it became low while the app slept, the scheduled one already went out.
 */
function restockPlan(now: Date): Reminder[] {
  const s = useStore.getState();
  const out: Reminder[] = [];
  const add: InboxItem[] = [];
  const warned: Record<string, string> = {};
  for (const x of s.supplements) {
    if (!x.stock) continue;
    const at = restockAt(x, s.intakes, now);
    if (!at) continue;
    const left = stockLeft(x, s.intakes)!;
    const days = daysLeft(x, s.intakes)!;
    const body = `${days <= 0 ? 'Finished' : `About ${days} ${days === 1 ? 'day' : 'days'} left`} · ${formatAmount(left, x.stock.unit)}`;
    const title = `Time to buy ${x.name}`;
    if (at > now) {
      out.push({ id: `restock-${x.id}`, at, title, body });
    } else if (x.stock.warned !== x.stock.at) {
      warned[x.id] = x.stock.at;
      add.push({ id: uid(), at: now.toISOString(), kind: 'restock', title, body, supplementId: x.id, read: false });
      if (Date.parse(x.stock.at) > at.getTime()) out.push({ id: `restock-${x.id}`, at: new Date(now.getTime() + 2000), title, body });
    }
  }
  if (add.length) {
    s.set({
      inbox: [...add, ...s.inbox].slice(0, 100),
      supplements: s.supplements.map((x) => (warned[x.id] && x.stock ? { ...x, stock: { ...x.stock, warned: warned[x.id] } } : x)),
    });
  }
  return out;
}

async function replan() {
  const { supplements, intakes, skipped, entries, ready } = useStore.getState();
  if (!ready) return;
  try {
    const now = new Date();
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(pending.filter((n) => /^(intake|meal|restock)-/.test(n.identifier)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
    // Reminders already on screen for a time that is now answered go away.
    const shown = await Notifications.getPresentedNotificationsAsync().catch(() => []);
    for (const n of shown) {
      const id = n.request.identifier;
      if (!id.startsWith('intake-')) continue;
      const { date, time } = slot(id);
      if (supplements.filter((x) => x.time === time).every((x) => answered(x.id, date, intakes, skipped))) Notifications.dismissNotificationAsync(id).catch(() => {});
    }
    const plan = [
      ...restockPlan(now),
      // The time the Live Activity reminder is showing needs no notifications.
      ...reminderPlan(supplements, intakes, now, 10, { skipped, nags: NAGS, max: 44 }).filter((r) => {
        const live = intakeSlot();
        if (!live) return true;
        const { date, time } = slot(r.id);
        return `${date}|${time}` !== live;
      }),
      ...mealPlan(entries, now).slice(0, 14),
    ];
    if (!plan.length) return;
    await installSounds();
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted && !(perm.canAskAgain && (await Notifications.requestPermissionsAsync()).granted)) return;
    for (const r of plan) {
      const intake = r.id.startsWith('intake-');
      await Notifications.scheduleNotificationAsync({
        identifier: r.id,
        content: {
          title: r.title, body: r.body, sound: BEEP, data: { intake: r.id },
          // Repeats of one reminder stack together.
          ...(intake ? { categoryIdentifier: CATEGORY, threadIdentifier: r.id.split('-').slice(0, 5).join('-') } : {}),
        },
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

/** Plans the notifications again shortly (also after the Live Activity reminder starts or ends). */
export const soon = () => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(replan, 800);
};

// The buttons open the app, which applies them: a button that leaves the app closed is not reliably
// delivered to it (the Live Activity reminder is the way to answer without opening the app).
Notifications.setNotificationCategoryAsync(CATEGORY, [
  { identifier: 'taken', buttonTitle: 'Taken', options: { opensAppToForeground: true } },
  { identifier: 'skip', buttonTitle: 'Skip', options: { opensAppToForeground: true, isDestructive: true } },
]).catch(() => {});

/** Acts on a tap or a button; waits for the saved data when the app was started by the tap. */
function respond(res: Notifications.NotificationResponse) {
  const go = () => {
    const id = res.notification.request.identifier;
    if (id.startsWith('meal-')) return void setTimeout(() => router.navigate('/(tabs)/food'), 300);
    if (id.startsWith('restock-')) return void setTimeout(() => router.push('/inbox'), 300);
    if (!id.startsWith('intake-')) return;
    const { date, time } = slot(id);
    if (res.actionIdentifier === 'taken') answerSlot(date, time, 'taken');
    else if (res.actionIdentifier === 'skip') answerSlot(date, time, 'skip');
    else setTimeout(() => router.push('/inbox'), 300);
  };
  if (useStore.getState().ready) return go();
  const off = useStore.subscribe((s) => { if (s.ready) { off(); go(); } });
}

Notifications.addNotificationResponseReceivedListener(respond);
// A tap that started the app may arrive before the listener: the last one is checked once (answers are
// safe to apply twice).
Notifications.getLastNotificationResponseAsync?.().then((r) => {
  if (!r) return;
  respond(r);
  // Handled once: not again on the next start.
  try { Notifications.clearLastNotificationResponse?.(); } catch {}
}).catch(() => {});

useStore.subscribe((s, prev) => {
  if (s.ready && (s.supplements !== prev.supplements || s.intakes !== prev.intakes || s.skipped !== prev.skipped || s.entries !== prev.entries || s.ready !== prev.ready)) soon();
});
AppState.addEventListener('change', (state) => state === 'active' && soon());

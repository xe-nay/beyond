import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, LinearTransition, useReducedMotion } from 'react-native-reanimated';

import { Bell } from '../../../src/components/Bell';
import { DayFlash, shortDate } from '../../../src/components/DayFlash';
import { DailyIntake } from '../../../src/components/DailyIntake';
import { Icon } from '../../../src/components/Icon';
import { NutritionCard } from '../../../src/components/NutritionCard';
import { Card, Press, Row, Screen, Section, T } from '../../../src/components/ui';
import type { FoodEntry } from '../../../src/domain/types';
import { MEALS } from '../../../src/meals';
import { eatenOn, isPlanned, today, useStore } from '../../../src/store';
import { alpha, colors, radius, space, type } from '../../../src/theme';
import { useDaySwipe } from '../../../src/useDaySwipe';

export default function Food() {
  const router = useRouter();
  const reduced = useReducedMotion();
  const s = useStore();
  const [offset, setOffset] = useState(0);
  const lastTap = useRef(0);
  // Opened from a day's Edit: show that day.
  const { date: asked } = useLocalSearchParams<{ date?: string }>();
  useEffect(() => {
    if (asked) setOffset(Math.round((Date.parse(`${asked}T12:00:00`) - Date.parse(`${today()}T12:00:00`)) / 86400000));
  }, [asked]);
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const date = today(d);
  const entries = s.entries.filter((e) => e.date === date);
  const total = eatenOn(s, date);
  // Every product you have used, favourites and the most recent first; one card per product even when
  // it is also saved under a scanned barcode.
  const recent = useMemo(() => {
    const seen = new Set<string>();
    return Object.values(s.foods)
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.lastUsed.localeCompare(a.lastUsed))
      .filter((f) => { const k = `${f.name.toLowerCase()}|${(f.brand ?? '').toLowerCase()}`; if (seen.has(k)) return false; seen.add(k); return true; });
  }, [s.foods]);

  // Swipe sideways anywhere on the page to change day; the day stays in the title (also once scrolled),
  // an amber Today chip appears away from today, and the new day shows big for a moment.
  const last = 14;
  const atEnd = offset >= last;
  const { gesture: swipe, style: slide, go } = useDaySwipe((n) => setOffset((o) => Math.max(-365, Math.min(last, o + n))), (n) => n < 0 || offset < last);

  return (
    <GestureDetector gesture={swipe}>
    <View style={{ flex: 1 }}>
    <Screen>
      <Stack.Screen options={{ title: offset === 0 ? 'Food' : shortDate(date), headerRight: () => <Bell /> }} />
      {/* Day switcher */}
      <Row style={{ justifyContent: 'space-between', marginTop: -space.sm }}>
        <Press onPress={() => go(-1)} hitSlop={10}><Icon name="chevron.left" size={16} color={colors.dim} /></Press>
        {/* Two taps on the date go back to today. */}
        <Press haptic={false} label="Day; tap twice for today" onPress={() => { const now = Date.now(); if (now - lastTap.current < 400) setOffset(0); lastTap.current = now; }}>
        <Animated.View key={offset} entering={reduced ? undefined : FadeIn.duration(180)}><T v="headline" color={offset === 0 ? colors.text : colors.amber}>{offset === 0 ? 'Today' : offset === -1 ? 'Yesterday' : offset === 1 ? 'Tomorrow' : d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</T></Animated.View>
        </Press>
        <Press onPress={() => go(1)} hitSlop={10} disabled={atEnd}><Icon name="chevron.right" size={16} color={colors.dim} /></Press>
      </Row>

      <Animated.View style={[{ gap: space.lg }, slide]}>
      <DailyIntake date={date} />

      <NutritionCard n={total} targets={s.targets} onPress={() => router.push('/targets')} />

      {/* The one action: scan */}
      <Press onPress={() => router.push({ pathname: '/scan', params: { date } })} style={{ height: 76, borderRadius: radius.xl, backgroundColor: colors.cyan, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.md }}>
        <Icon name="barcode.viewfinder" size={28} color={colors.black} />
        <T v="title" color={colors.black}>Scan food</T>
      </Press>

      {recent.length > 0 && (
        <Section title="Quick add">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }} style={{ marginHorizontal: -space.lg }}>
            <View style={{ width: space.sm }} />
            {recent.map((f) => (
              <Press key={f.id} onPress={() => router.push({ pathname: '/food/[id]', params: { id: f.id, date } })} style={{ width: 104, gap: 6 }}>
                <View style={{ width: 104, height: 104, borderRadius: radius.md, backgroundColor: f.image ? '#F3F5F9' : colors.surface2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                  {f.image ? <Image source={f.image} style={{ width: 104, height: 104 }} contentFit="contain" cachePolicy="disk" /> : <Icon name="fork.knife" size={26} color={colors.dim} />}
                  {f.favorite && <View style={{ position: 'absolute', top: 6, right: 6 }}><Icon name="star.fill" size={12} color={colors.amber} /></View>}
                </View>
                <T v="label" numberOfLines={2}>{f.name}</T>
              </Press>
            ))}
            <View style={{ width: space.sm }} />
          </ScrollView>
        </Section>
      )}

      {MEALS.map((m) => {
        const list = entries.filter((e) => e.meal === m.value).sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
        const kcal = list.filter((e) => !isPlanned(e)).reduce((n, e) => n + e.nutrients.kcal, 0);
        return (
          <Section key={m.value} title={m.label} action={<T v="label" color={colors.dim} style={type.num}>{kcal ? `${kcal} kcal` : ''}</T>}>
            <Card style={{ padding: list.length ? space.sm : space.md, gap: 0 }}>
              {list.map((e) => (
                <Animated.View key={e.id} entering={reduced ? undefined : FadeIn.duration(200)} layout={reduced ? undefined : LinearTransition.duration(200)}>
                  <EntryRow e={e} onPress={() => router.push({ pathname: '/food/[id]', params: { id: e.foodId, entry: e.id } })} />
                </Animated.View>
              ))}
              {!list.length && (
                <Press onPress={() => router.push({ pathname: '/scan', params: { date, meal: m.value } })} haptic={false}>
                  <Row gap={space.sm}><Icon name="plus" size={13} color={colors.faint} /><T v="label" color={colors.faint}>Scan to add</T></Row>
                </Press>
              )}
            </Card>
          </Section>
        );
      })}
      <T v="caption" color={colors.faint} style={{ textAlign: 'center', textTransform: 'none' }}>Food data from Open Food Facts (ODbL)</T>
      </Animated.View>
    </Screen>
    <DayFlash date={date} />
    </View>
    </GestureDetector>
  );
}

function EntryRow({ e, onPress }: { e: FoodEntry; onPress: () => void }) {
  const planned = isPlanned(e);
  return (
    <Press onPress={onPress} haptic={false} style={planned ? { opacity: 0.6 } : undefined}>
      <Row style={{ padding: space.sm }}>
        <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: '#F3F5F9', overflow: 'hidden' }}>
          {e.image ? <Image source={e.image} style={{ flex: 1 }} contentFit="contain" cachePolicy="disk" /> : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(colors.cyan, 0.15) }}><Icon name="fork.knife" size={16} color={colors.cyan} /></View>}
        </View>
        <View style={{ flex: 1 }}>
          <T v="headline" numberOfLines={1}>{e.name}</T>
          <T v="label" color={planned ? colors.amber : colors.dim} numberOfLines={1}>{[planned ? `Planned ${e.time}` : e.time, e.brand, `${Math.round(e.amount)} ${e.basis}`].filter(Boolean).join(' · ')}</T>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <T v="headline" style={type.num}>{e.nutrients.kcal}</T>
          <T v="caption" color={colors.faint}>kcal</T>
        </View>
      </Row>
    </Press>
  );
}

import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Extrapolation, FadeIn, interpolate, LinearTransition, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { DailyIntake } from '../../../src/components/DailyIntake';
import { Icon } from '../../../src/components/Icon';
import { NutritionCard } from '../../../src/components/NutritionCard';
import { Card, Press, Row, Screen, Section, T } from '../../../src/components/ui';
import type { FoodEntry } from '../../../src/domain/types';
import { MEALS } from '../../../src/meals';
import { eatenOn, isPlanned, today, useStore } from '../../../src/store';
import { alpha, colors, radius, space, type } from '../../../src/theme';

export default function Food() {
  const router = useRouter();
  const reduced = useReducedMotion();
  const s = useStore();
  const [offset, setOffset] = useState(0);
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
  const recent = Object.values(s.foods).sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.lastUsed.localeCompare(a.lastUsed)).slice(0, 12);

  // Swipe sideways anywhere on the page to change day (left: next, right: previous). The day follows
  // the finger, slides out, and the next one slides in from the other side, so the change is seen.
  const { width } = useWindowDimensions();
  const x = useSharedValue(0);
  const last = 14;
  const arrive = (step: number) => {
    setOffset((o) => Math.max(-365, Math.min(last, o + step)));
    if (reduced) return;
    x.set(withSequence(withTiming(step * width * 0.35, { duration: 0 }), withSpring(0, { duration: 420, dampingRatio: 0.9 })));
  };
  const go = (step: number) => {
    if (step > 0 && offset >= last) return;
    if (reduced) return arrive(step);
    x.set(withTiming(-step * width * 0.45, { duration: 150 }, (done) => { if (done) scheduleOnRN(arrive, step); }));
  };
  const atEnd = offset >= last;
  const swipe = Gesture.Pan()
    .activeOffsetX([-28, 28])
    .failOffsetY([-14, 14])
    .onUpdate((e) => {
      if (reduced) return;
      // No next day past the last one: it only gives a little.
      x.set(e.translationX < 0 && atEnd ? e.translationX * 0.15 : e.translationX * 0.8);
    })
    .onEnd((e) => {
      if (e.translationX < -60 || e.velocityX < -600) scheduleOnRN(go, 1);
      else if (e.translationX > 60 || e.velocityX > 600) scheduleOnRN(go, -1);
      if (!(Math.abs(e.translationX) > 60 || Math.abs(e.velocityX) > 600) || (e.translationX < 0 && atEnd)) x.set(withSpring(0, { duration: 350, dampingRatio: 0.85 }));
    });
  const slide = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }],
    opacity: interpolate(Math.abs(x.get()), [0, width * 0.45], [1, 0.25], Extrapolation.CLAMP),
  }));

  return (
    <GestureDetector gesture={swipe}>
    <View style={{ flex: 1 }}>
    <Screen>
      {/* Day switcher */}
      <Row style={{ justifyContent: 'space-between', marginTop: -space.sm }}>
        <Press onPress={() => go(-1)} hitSlop={10}><Icon name="chevron.left" size={16} color={colors.dim} /></Press>
        <Animated.View key={offset} entering={reduced ? undefined : FadeIn.duration(180)}><T v="headline">{offset === 0 ? 'Today' : offset === -1 ? 'Yesterday' : offset === 1 ? 'Tomorrow' : d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</T></Animated.View>
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

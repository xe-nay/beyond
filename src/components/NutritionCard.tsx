// The day's nutrition as a card that turns over. Front: energy and the three macros. Back: the
// micronutrients against their daily values, a few per page; swipe sideways through the pages.
// Tap the card (or use the switch above it) to turn it; hold the front to change the goals.
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { formatMicro, MICRO, type MicroUnit } from '../domain/micros';
import { innerSwipe } from '../swipeGuard';
import type { Nutrients, NutritionTargets } from '../domain/types';
import { alpha, colors, radius, space, type } from '../theme';
import { Icon } from './Icon';
import { MacroDonut, MacroLegend } from './Nutrition';
import { PageDots, Press, Row, Segmented, T } from './ui';

type Line = { label: string; value: number; unit: MicroUnit | 'g'; dv: number | null; limit?: boolean };
const PAGES: { title: string; keys: string[] }[] = [
  { title: 'Fats, sugar, fibre', keys: ['fiber', 'sugar', 'satFat', 'cholesterol', 'omega3'] },
  { title: 'Minerals', keys: ['sodium', 'potassium', 'calcium', 'magnesium', 'iron'] },
  { title: 'Minerals', keys: ['zinc', 'phosphorus', 'selenium', 'iodine'] },
  { title: 'Vitamins', keys: ['vitaminA', 'vitaminC', 'vitaminD', 'vitaminE', 'vitaminK'] },
  { title: 'Vitamins B', keys: ['b1', 'b2', 'b3', 'b6', 'folate', 'b12'] },
  { title: 'Other', keys: ['caffeine', 'creatine'] },
];
// Label values that live on the main nutrient record, with FDA daily values (sugar and saturated fat are limits).
const BASIC: Record<string, Omit<Line, 'value'>> = {
  fiber: { label: 'Fibre', unit: 'g', dv: 28 },
  sugar: { label: 'Sugars', unit: 'g', dv: 50, limit: true },
  satFat: { label: 'Saturated fat', unit: 'g', dv: 20, limit: true },
};

function line(n: Nutrients, key: string): Line {
  if (BASIC[key]) return { ...BASIC[key], value: (n as any)[key] ?? 0 };
  const m = MICRO[key];
  return { label: m.label, unit: m.unit, dv: m.dv, limit: m.limit, value: n.micro?.[key] ?? 0 };
}

// The least height; a page with more rows (or larger text) makes the card taller rather than cutting it.
const H = 236;
const DOTS = 6;

export function NutritionCard({ n, targets, onPress }: { n: Nutrients; targets: NutritionTargets; onPress?: () => void }) {
  const reduced = useReducedMotion();
  const turn = useSharedValue(0);
  const [back, setBack] = useState(false);
  const [page, setPage] = useState(0);
  const [w, setW] = useState(0);
  // Each page's rows, measured at the current width; the card is as tall as the tallest.
  const [heights, setHeights] = useState<{ w: number; h: Record<number, number> }>({ w: 0, h: {} });
  const tallest = heights.w === w ? Math.max(0, ...Object.values(heights.h)) : 0;
  const height = Math.max(H, tallest + DOTS + space.sm + space.lg * 2 + 4);
  const measured = (i: number, h: number) => setHeights((x) => (x.w === w && Math.abs((x.h[i] ?? 0) - h) < 0.5 ? x : { w, h: { ...(x.w === w ? x.h : {}), [i]: h } }));
  const left = targets.kcal - n.kcal;

  // The face shown is a choice, not a toggle of the animation's position, so quick taps never
  // turn it the wrong way.
  const show = (micros: boolean) => {
    if (micros === back) return;
    turn.set(reduced ? withTiming(micros ? 1 : 0, { duration: 1 }) : withSpring(micros ? 1 : 0, { duration: 650, dampingRatio: 0.8 }));
    setBack(micros);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };
  const flip = () => show(!back);
  // A tap turns the card. (A vertical swipe would fight the page's own scrolling, which iOS lets win.)

  const front = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateX: `${interpolate(turn.get(), [0, 1], [0, 180])}deg` }],
    opacity: turn.get() < 0.5 ? 1 : 0,
  }));
  const rear = useAnimatedStyle(() => ({
    transform: [{ perspective: 1200 }, { rotateX: `${interpolate(turn.get(), [0, 1], [-180, 0])}deg` }],
    opacity: turn.get() >= 0.5 ? 1 : 0,
  }));

  return (
    <View style={{ gap: space.sm }}>
    <Segmented options={[{ value: 'macros', label: 'Macros' }, { value: 'micros', label: 'Micros' }]} value={back ? 'micros' : 'macros'} onChange={(v) => show(v === 'micros')} />
      <View style={{ height }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        <Animated.View style={[styles.face, front]} pointerEvents={back ? 'none' : 'auto'}>
          {/* Held, not tapped, so scrolling past the card never opens the goals. */}
          <Press onPress={flip} onLongPress={onPress && (() => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); onPress(); })} haptic={false} label="Hold to change your daily goals" style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.xl }}>
            <MacroDonut n={n} size={136} label={`of ${targets.kcal}`} />
            <View style={{ flex: 1, gap: space.md }}>
              <View>
                <T v="caption" color={colors.faint}>{left >= 0 ? 'Remaining' : 'Over'}</T>
                <T v="title" color={left >= 0 ? colors.lime : colors.amber} style={type.num}>{Math.abs(left)} kcal</T>
              </View>
              <MacroLegend n={n} targets={targets} />
              <T v="caption" color={colors.faint} style={{ textTransform: 'none', letterSpacing: 0 }}>Tap for micros{onPress ? ' · hold to change goals' : ''}</T>
            </View>
          </Press>
        </Animated.View>

        <Animated.View style={[styles.face, rear]} pointerEvents={back ? 'auto' : 'none'}>
          {/* A tap anywhere on the micros turns back to the macros; sideways pages through them. */}
          <Press onPress={flip} haptic={false} label="Back to macros" style={{ flex: 1 }}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={(e) => w && setPage(Math.round(e.nativeEvent.contentOffset.x / w))}
            // Paging the micros is not a day swipe.
            onScrollBeginDrag={() => innerSwipe.set(1)}
            onScrollEndDrag={() => innerSwipe.set(0)}
            scrollEventThrottle={32}
            style={{ marginHorizontal: -space.lg }}>
            {w > 0 && PAGES.map((p, i) => (
              <View key={i} style={{ width: w, paddingHorizontal: space.lg }}>
                {/* Measured on its own: the page stretches to the card, its rows do not. */}
                <View style={{ gap: 8 }} onLayout={(e) => measured(i, e.nativeEvent.layout.height)}>
                  <T v="caption" color={colors.faint}>{p.title}</T>
                  {p.keys.map((k) => <MicroRow key={k} l={line(n, k)} />)}
                </View>
              </View>
            ))}
          </ScrollView>
          </Press>
          <Press onPress={flip} haptic={false} label="Back to macros">
            <Row gap={8} style={{ justifyContent: 'center' }}>
              <PageDots count={PAGES.length} index={Math.min(PAGES.length - 1, page)} color={colors.cyan} />
            </Row>
          </Press>
        </Animated.View>
      </View>
    </View>
  );
}

function MicroRow({ l }: { l: Line }) {
  const share = l.dv ? l.value / l.dv : 0;
  const over = l.limit && share > 1;
  const color = over ? colors.amber : share >= 1 ? colors.lime : colors.cyan;
  return (
    <View style={{ gap: 4 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T v="footnote">{l.label}</T>
        <T v="footnote" color={colors.dim} style={type.num}>
          {formatMicro(l.value, l.unit as MicroUnit)}{l.dv ? <T v="footnote" color={colors.faint}> / {l.dv} {l.unit}{l.limit ? ' max' : ''}</T> : null}
        </T>
      </Row>
      <View style={styles.track}>
        <View style={[styles.fill, { backgroundColor: color, width: `${Math.min(100, share * 100)}%`, transitionProperty: 'width', transitionDuration: 500 } as any]} />
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  face: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backfaceVisibility: 'hidden', padding: space.lg, gap: space.sm,
    backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline,
  },
  corner: { position: 'absolute', top: 10, right: 12, zIndex: 2, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, height: 24, borderRadius: 12, backgroundColor: alpha(colors.cyan, 0.12) },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.surface3, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
});

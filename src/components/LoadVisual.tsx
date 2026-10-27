// Load visuals for the active set: plates stacking onto a barbell, one or two dumbbells that move
// like the exercise, a kettlebell, a machine weight stack. Switching kg/lb reloads with that unit's
// own plates and snaps to a weight they can make.
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, {
  Easing, LinearTransition, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';

import type { LoadKind } from '../catalog';
import { BARS, dumbbellStep, formatWeight, loadBarbell, roundTo, toDisplay, toKg, type Plate } from '../domain/plates';
import type { Unit } from '../domain/types';
import { alpha, colors, radius, space, type } from '../theme';
import { Icon } from './Icon';
import { Press, Row, Segmented, T, tap } from './ui';

const H = 120; // full plate height in points
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

/**
 * A plate slides along the sleeve from its outer end and lands against the previous one with a
 * small rebound. New plates go on one after another, so a big jump reads as stacking.
 */
const stackIn = (dx: number, delay: number) => () => {
  'worklet';
  return {
    initialValues: { opacity: 0, transform: [{ translateX: dx }, { scaleY: 0.92 }] },
    animations: {
      opacity: withDelay(delay, withTiming(1, { duration: 90 })),
      transform: [
        { translateX: withDelay(delay, withSequence(withTiming(-dx * 0.04, { duration: 210, easing: EASE_OUT }), withSpring(0, { duration: 260, dampingRatio: 0.5 }))) },
        { scaleY: withDelay(delay + 200, withSequence(withTiming(1.03, { duration: 70 }), withSpring(1, { duration: 220, dampingRatio: 0.6 }))) },
      ],
    },
  };
};
const slideOut = (dx: number, delay: number) => () => {
  'worklet';
  return {
    initialValues: { opacity: 1, transform: [{ translateX: 0 }] },
    animations: {
      opacity: withDelay(delay + 80, withTiming(0, { duration: 120 })),
      transform: [{ translateX: withDelay(delay, withTiming(dx, { duration: 200, easing: EASE_OUT })) }],
    },
  };
};

function PlateView({ plate, side, unit, delay }: { plate: Plate; side: 'l' | 'r'; unit: Unit; delay: number }) {
  const reduced = useReducedMotion();
  const w = 8 + plate.thickness * 12;
  const h = H * plate.height;
  const light = plate.color === '#E8ECF2' || plate.color === '#F2C230';
  const dir = side === 'r' ? 1 : -1;
  return (
    <Animated.View
      entering={reduced ? undefined : stackIn(dir * 90, delay)}
      exiting={reduced ? undefined : slideOut(dir * 90, 0)}
      layout={reduced ? undefined : LinearTransition.springify().duration(320).dampingRatio(0.85)}
      style={[styles.plate, { width: w, height: h, backgroundColor: plate.color }]}>
      <View style={[styles.plateShine, { height: h - 8 }]} />
      {plate.height >= 0.7 && (
        <T style={{ fontSize: 9, fontWeight: '800', transform: [{ rotate: '-90deg' }], width: 28, textAlign: 'center' }} color={light ? '#1B2233' : '#FFFFFF'}>
          {plate.weight}
        </T>
      )}
      {unit === 'lb' && plate.height >= 0.7 && <View style={styles.lbRim} />}
    </Animated.View>
  );
}

/** How many leading plates are unchanged, so only the new ones animate on. */
function useStable(perSide: Plate[], unit: Unit) {
  const prev = useRef<{ list: Plate[]; unit: Unit }>({ list: [], unit });
  let same = 0;
  if (prev.current.unit === unit) while (same < perSide.length && prev.current.list[same]?.weight === perSide[same].weight) same++;
  useEffect(() => {
    prev.current = { list: perSide, unit };
  });
  return same;
}

export function BarbellView({ kg, unit, bar }: { kg: number; unit: Unit; bar?: number }) {
  const total = roundTo(toDisplay(kg, unit), unit === 'kg' ? 0.5 : 1);
  const l = loadBarbell(total, unit, bar ?? BARS[unit]);
  const same = useStable(l.perSide, unit);
  const delay = (i: number) => Math.max(0, i - same) * 110;
  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.barWrap}>
        <View style={styles.shaft} />
        <View style={styles.knurl} />
        {/* Left sleeve: plates stack outward from the collar. */}
        <View style={[styles.sleeve, { left: 0 }]}>
          <View style={[styles.sleeveRod, { left: 0, right: 0 }]} />
          <View style={[styles.stack, { justifyContent: 'flex-end' }]}>
            {[...l.perSide].reverse().map((p, ri) => {
              const i = l.perSide.length - 1 - ri;
              return <PlateView key={`l${i}-${p.weight}-${unit}`} plate={p} side="l" unit={unit} delay={delay(i)} />;
            })}
          </View>
          <View style={[styles.collar, { right: -2 }]} />
        </View>
        <View style={[styles.sleeve, { right: 0 }]}>
          <View style={[styles.sleeveRod, { left: 0, right: 0 }]} />
          <View style={[styles.stack, { justifyContent: 'flex-start' }]}>
            {l.perSide.map((p, i) => <PlateView key={`r${i}-${p.weight}-${unit}`} plate={p} side="r" unit={unit} delay={delay(i)} />)}
          </View>
          <View style={[styles.collar, { left: -2 }]} />
        </View>
      </View>
      <Row style={{ justifyContent: 'center' }} gap={6}>
        <T v="label" color={colors.dim}>
          {l.perSide.length ? `${l.perSide.map((p) => p.weight).join(' · ')} per side` : 'Empty bar'} · bar {l.bar} {unit}
        </T>
        {l.missing > 0 && <T v="label" color={colors.amber}>+{l.missing} {unit} won't load</T>}
      </Row>
    </View>
  );
}

export type Motion = 'press' | 'curl' | 'row' | 'raise' | 'carry';

/** The movement a dumbbell exercise makes, from its name and variation group. */
export function motionFor(name: string, group: string | null): Motion {
  const s = `${group ?? ''} ${name}`.toLowerCase();
  if (/curl/.test(s)) return 'curl';
  if (/raise|fly|reverse-fly|face pull/.test(s)) return 'raise';
  if (/row|pull|shrug|deadlift|rdl|swing/.test(s)) return 'row';
  if (/press|push|bench|dip|extension|skull|pullover/.test(s)) return 'press';
  return 'carry';
}

function Dumbbell({ kg, unit, mirror, lift, motion, delayIndex }: { kg: number; unit: Unit; mirror: boolean; lift: { get(): number }; motion: Motion; delayIndex: number }) {
  const reduced = useReducedMotion();
  const v = toDisplay(kg, unit);
  const plates = Math.max(1, Math.min(5, Math.ceil(v / (unit === 'kg' ? 8 : 18))));
  const prev = useRef(plates);
  const fresh = plates > prev.current ? prev.current : plates;
  useEffect(() => {
    prev.current = plates;
  });
  const m = mirror ? -1 : 1;
  const style = useAnimatedStyle(() => {
    const t = lift.get();
    switch (motion) {
      case 'press': return { transform: [{ translateY: -26 * t }] };
      case 'curl': return { transform: [{ translateY: -18 * t }, { translateX: -8 * t * m }, { rotate: `${-55 * t * m}deg` }] };
      case 'row': return { transform: [{ translateY: -14 * t }, { translateX: 10 * t * m }, { rotate: `${8 * t * m}deg` }] };
      case 'raise': return { transform: [{ translateX: 20 * t * m }, { translateY: -16 * t }, { rotate: `${-30 * t * m}deg` }] };
      default: return { transform: [{ translateY: 6 * t }] };
    }
  });
  const head = (side: 'l' | 'r') => (
    <View style={{ flexDirection: side === 'l' ? 'row-reverse' : 'row', alignItems: 'center' }}>
      {Array.from({ length: plates }, (_, i) => (
        <Animated.View
          key={i}
          entering={reduced ? undefined : stackIn(side === 'r' ? 26 : -26, Math.max(0, i - fresh) * 90 + delayIndex * 40)}
          exiting={reduced ? undefined : slideOut(side === 'r' ? 26 : -26, 0)}
          layout={reduced ? undefined : LinearTransition.duration(220)}
          style={[styles.dbPlate, { height: 54 - i * 4, backgroundColor: i % 2 ? '#1E2A40' : '#2A3A58' }]}
        />
      ))}
      <View style={styles.dbCap} />
    </View>
  );
  return (
    <Animated.View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>
      {head('l')}
      <View style={styles.dbHandle}><View style={styles.dbGrip} /></View>
      {head('r')}
    </Animated.View>
  );
}

/**
 * One or two dumbbells. Completing a set plays one rep of the exercise's movement: both together
 * for presses and raises, the second a beat behind for curls and rows, like alternating arms.
 */
export function DumbbellView({ kg, unit, pulse = 0, count = 2, motion = 'carry' }: { kg: number; unit: Unit; pulse?: number; count?: 1 | 2; motion?: Motion }) {
  const reduced = useReducedMotion();
  const a = useSharedValue(0);
  const b = useSharedValue(0);
  useEffect(() => {
    if (!pulse || reduced) return;
    const rep = (d: number) => withDelay(d, withSequence(withTiming(1, { duration: 320, easing: EASE_OUT }), withTiming(1, { duration: 120 }), withSpring(0, { duration: 520, dampingRatio: 0.7 })));
    a.set(rep(0));
    b.set(rep(motion === 'curl' || motion === 'row' ? 180 : 0));
  }, [pulse]);
  const v = toDisplay(kg, unit);
  return (
    <View style={{ alignItems: 'center', gap: space.md }}>
      <View style={{ flexDirection: count === 2 ? 'column' : 'row', gap: 14, alignItems: 'center' }}>
        <Dumbbell kg={kg} unit={unit} mirror={false} lift={a} motion={motion} delayIndex={0} />
        {count === 2 && <Dumbbell kg={kg} unit={unit} mirror={motion === 'raise'} lift={b} motion={motion} delayIndex={1} />}
      </View>
      <T v="label" color={colors.dim}>{count === 2 ? `2 × ${formatNum(v)} ${unit} · ${formatNum(v * 2)} ${unit} total` : `${formatNum(v)} ${unit}`}</T>
    </View>
  );
}

// A gym's fixed dumbbells, in the unit's usual steps.
export const RACK: Record<Unit, number[]> = {
  kg: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42.5, 45, 47.5, 50],
  lb: [5, 8, 10, 12, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100],
};
const COL = 78;

/** One dumbbell on the rack. The chosen one lifts out; on a completed set it plays one rep of the exercise. */
function RackBell({ w, unit, max, selected, onPress, pulse, motion }: { w: number; unit: Unit; max: number; selected: boolean; onPress: () => void; pulse: number; motion: Motion }) {
  const reduced = useReducedMotion();
  const t = w / max; // 0..1, sizes the heads
  const head = 20 + t * 22;
  const plate = 8 + t * 10;
  const lift = useSharedValue(selected ? 1 : 0);
  const rep = useSharedValue(0);
  useEffect(() => {
    lift.set(withSpring(selected ? 1 : 0, { duration: 420, dampingRatio: 0.6 }));
  }, [selected]);
  useEffect(() => {
    if (!selected || !pulse || reduced) return;
    rep.set(withSequence(withTiming(1, { duration: 300, easing: EASE_OUT }), withTiming(1, { duration: 100 }), withSpring(0, { duration: 520, dampingRatio: 0.6 })));
  }, [pulse]);
  const st = useAnimatedStyle(() => {
    const r = rep.get();
    const move =
      motion === 'press' ? [{ translateY: -14 * r }] :
      motion === 'curl' ? [{ translateY: -10 * r }, { rotate: `${-40 * r}deg` }] :
      motion === 'row' ? [{ translateY: -8 * r }, { translateX: 6 * r }] :
      motion === 'raise' ? [{ translateY: -10 * r }, { rotate: `${-22 * r}deg` }] :
      [{ translateY: 4 * r }];
    return { transform: [{ translateY: -8 * lift.get() }, { scale: 1 + 0.1 * lift.get() }, ...move] as any };
  });
  const color = selected ? colors.cyan : '#3A4A66';
  return (
    <Pressable onPress={onPress} style={{ width: COL, height: 70, alignItems: 'center', justifyContent: 'flex-end' }} accessibilityLabel={`${w} ${unit}`}>
      <Animated.View style={[{ alignItems: 'center' }, st]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', shadowColor: colors.cyan, shadowOpacity: selected ? 0.6 : 0, shadowRadius: 10 }}>
          <View style={{ width: plate, height: head, borderRadius: 5, backgroundColor: color }} />
          <View style={{ width: 24, height: 7, borderRadius: 3.5, backgroundColor: selected ? '#DDF8FB' : '#8D99AB' }} />
          <View style={{ width: plate, height: head, borderRadius: 5, backgroundColor: color }} />
        </View>
        <T style={[type.footnote, type.num, { marginTop: 5, fontWeight: '700' }]} color={selected ? colors.cyan : colors.dim}>{w}</T>
      </Animated.View>
    </Pressable>
  );
}

/**
 * The dumbbell rack: two tiers, lighter to heavier from left to right, scrolled sideways.
 * Tapping a dumbbell takes it; the steppers can still fine-tune the weight after.
 */
export function DumbbellRack({ kg, unit, onPick, count = 2, pulse = 0, motion = 'carry' }: { kg: number; unit: Unit; onPick: (kg: number) => void; count?: 1 | 2; pulse?: number; motion?: Motion }) {
  const list = RACK[unit];
  const v = roundTo(toDisplay(kg, unit), 0.5);
  const max = list[list.length - 1];
  const cols = Math.ceil(list.length / 2);
  const ref = useRef<ScrollView>(null);
  const at = list.findIndex((x) => Math.abs(x - v) < 0.26);
  useEffect(() => {
    if (at >= 0) ref.current?.scrollTo({ x: Math.max(0, Math.floor(at / 2) * COL - COL * 1.5), animated: true });
  }, [at, unit]);
  return (
    <View style={{ gap: space.sm }}>
      <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 4 }}>
        <View>
          {[0, 1].map((tier) => (
            <View key={tier} style={{ flexDirection: 'row', paddingBottom: 8 }}>
              {/* The rail the dumbbells sit on */}
              <View style={{ position: 'absolute', left: 6, right: 6, bottom: 27, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.07)' }} />
              {Array.from({ length: cols }, (_, c) => {
                const w = list[c * 2 + tier];
                return w === undefined ? <View key={c} style={{ width: COL }} /> : (
                  <RackBell key={c} w={w} unit={unit} max={max} selected={at === c * 2 + tier} pulse={pulse} motion={motion} onPress={() => { tap(); onPick(toKg(w, unit)); }} />
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
      <T v="footnote" color={colors.dim} style={{ textAlign: 'center' }}>
        {at < 0 ? 'Custom · ' : ''}{count === 2 ? `2 × ${formatNum(v)} ${unit} · ${formatNum(v * 2)} ${unit} total` : `${formatNum(v)} ${unit}`}
      </T>
    </View>
  );
}

export function KettlebellView({ kg, unit, count = 1 }: { kg: number; unit: Unit; count?: 1 | 2 }) {
  const v = toDisplay(kg, unit);
  const size = 64 + Math.min(36, v);
  const bell = (k: number) => (
    <Animated.View key={k} layout={LinearTransition.duration(220)} style={{ alignItems: 'center' }}>
      <View style={[styles.kbHandle, { width: size * 0.62, height: size * 0.5, borderRadius: size * 0.3 }]} />
      <View style={[styles.kbBody, { width: size, height: size * 0.9, borderRadius: size * 0.45, marginTop: -size * 0.12 }]}>
        <T v="headline" color={colors.text} style={type.num}>{formatNum(v)}</T>
      </View>
    </Animated.View>
  );
  return <Row gap={space.lg} style={{ justifyContent: 'center' }}>{Array.from({ length: count }, (_, k) => bell(k))}</Row>;
}

/** Pin-loaded stack: the pin slides to the selected plate. */
const PLATE = 22; // plate height in points
const GAP = 3;
const SHOWN = 11; // plates visible at once; the column scrolls to keep the pin in view

/**
 * A selectorised machine stack: numbered plates, the pin on the plate that sets the weight, the
 * plates it lifts lit. Tap a plate to move the pin there. A weight between two plates shows as the
 * add-on on the top cap, like the small dial on a real stack.
 */
export function StackView({ kg, unit, onPick, pulse = 0 }: { kg: number; unit: Unit; onPick?: (kg: number) => void; pulse?: number }) {
  const reduced = useReducedMotion();
  const v = toDisplay(kg, unit);
  const step = unit === 'kg' ? 5 : 10;
  const pinned = Math.max(0, Math.floor((v + 0.01) / step)); // plates on the pin
  const addOn = Math.round((v - pinned * step) * 10) / 10;
  const n = Math.min(60, Math.max(20, pinned + 6));
  const row = PLATE + GAP;
  const first = Math.max(0, Math.min(n - SHOWN, pinned - SHOWN + 3)); // keep the pin near the bottom of the window

  const pinY = useSharedValue(Math.max(0, pinned - 1) * row);
  const scroll = useSharedValue(first * row);
  const lift = useSharedValue(0);
  useEffect(() => {
    const spring = { duration: 420, dampingRatio: 0.78 };
    pinY.set(reduced ? Math.max(0, pinned - 1) * row : withSpring(Math.max(0, pinned - 1) * row, spring));
    scroll.set(reduced ? first * row : withSpring(first * row, spring));
  }, [pinned, first]);
  // A completed set lifts the selected plates and sets them down again.
  useEffect(() => {
    if (!pulse || reduced) return;
    lift.set(withSequence(withTiming(-10, { duration: 260, easing: EASE_OUT }), withTiming(0, { duration: 420, easing: Easing.bezier(0.5, 0, 0.75, 0) })));
  }, [pulse]);

  const column = useAnimatedStyle(() => ({ transform: [{ translateY: -scroll.get() }] }));
  const pinStyle = useAnimatedStyle(() => ({ transform: [{ translateY: pinY.get() + lift.get() }] }));
  const lifted = useAnimatedStyle(() => ({ transform: [{ translateY: lift.get() }] }));

  const plate = (i: number) => {
    const on = i < pinned;
    const w = step * (i + 1);
    return (
      <Pressable
        key={i}
        onPress={() => { tap(); onPick?.(toKg(w, unit)); }}
        style={[styles.stackPlate, on && { backgroundColor: '#20323A', borderColor: alpha(colors.cyan, 0.45) }]}
        accessibilityLabel={`${w} ${unit}`}>
        <T style={[styles.plateNum, on && { color: colors.text }]}>{w}</T>
        <View style={[styles.hole, i === pinned - 1 && { backgroundColor: colors.black }]} />
        <T style={[styles.plateNum, { textAlign: 'right' }, on && { color: alpha(colors.cyan, 0.9) }]}>{w}</T>
      </Pressable>
    );
  };

  return (
    <View style={{ alignItems: 'center' }}>
      {/* Top cap with the cable rod, and the add-on weight when there is one */}
      <Animated.View style={[{ alignItems: 'center' }, lifted]}>
        <View style={styles.rod} />
        <View style={styles.cap}>
          <View style={[styles.addOn, addOn > 0 && { backgroundColor: colors.lime }]}>
            <T style={{ fontSize: 10, fontWeight: '800', color: addOn > 0 ? colors.black : colors.faint }}>{addOn > 0 ? `+${addOn}` : unit}</T>
          </View>
        </View>
      </Animated.View>
      <View style={{ height: SHOWN * row, overflow: 'hidden', width: 210, alignItems: 'center' }}>
        <Animated.View style={column}>
          <Animated.View style={lifted}>{Array.from({ length: Math.min(pinned, n) }, (_, i) => plate(i))}</Animated.View>
          {Array.from({ length: n - Math.min(pinned, n) }, (_, i) => plate(i + pinned))}
          {/* The pin, in the hole of the last lifted plate */}
          {pinned > 0 && (
            <Animated.View pointerEvents="none" style={[styles.pin, pinStyle]}>
              <View style={styles.pinHead} />
              <View style={styles.pinShaft} />
            </Animated.View>
          )}
        </Animated.View>
      </View>
    </View>
  );
}

const formatNum = (v: number) => (Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(1));

/** The weight picker shown in a workout: visual + number + steps + kg/lb switch (+ one/two for dumbbells). */
export function WeightControl({ kg, onChange, unit, onUnit, kind, pulse, count = 1, onCount, motion, body }: {
  kg: number; onChange: (kg: number) => void; unit: Unit; onUnit: (u: Unit) => void; kind: LoadKind; pulse?: number;
  count?: 1 | 2; onCount?: (n: 1 | 2) => void; motion?: Motion;
  /** Bodyweight exercises: the share of body weight moved and the lifter's weight; `kg` is then the added load. */
  body?: { share: number | null; weightKg: number | null; band: boolean };
}) {
  const display = toDisplay(kg, unit);
  const step = kind === 'barbell' ? (unit === 'kg' ? 2.5 : 5) : kind === 'dumbbell' ? dumbbellStep(unit, display) : kind === 'kettlebell' ? (unit === 'kg' ? 4 : 5) : unit === 'kg' ? 2.5 : 5;
  const [text, setText] = useState<string | null>(null);
  const set = (d: number) => onChange(Math.max(0, toKg(roundTo(d, unit === 'kg' ? 0.25 : 0.5), unit)));
  // A bodyweight exercise shows what it moves: its share of body weight plus any added load.
  const bodyPart = body?.share && body.weightKg ? body.share * body.weightKg : null;
  const label = kind !== 'bodyweight' ? formatNum(display)
    : bodyPart !== null && !body?.band ? formatWeight(bodyPart + kg, unit)
    : kg > 0 ? `+${formatNum(display)}` : body?.band ? 'Band' : 'BW';
  const bodyText = !body || kind !== 'bodyweight' ? null
    : body.band ? (kg > 0 ? 'Band plus added load' : 'Band')
    : body.share && body.weightKg ? `${Math.round(body.share * 100)}% of your ${formatNum(toDisplay(body.weightKg, unit))} ${unit} body weight${kg > 0 ? ` + ${formatNum(display)} ${unit}` : ''}`
    : body.share ? `Moves ${Math.round(body.share * 100)}% of body weight · add your weight in Progress to count it`
    : kg > 0 ? 'Body weight plus added load' : 'Body weight';
  const paired = kind === 'dumbbell' || kind === 'kettlebell';

  return (
    <View style={{ gap: space.lg }}>
      {kind === 'dumbbell' && <DumbbellRack kg={kg} unit={unit} onPick={onChange} count={count} pulse={pulse} motion={motion} />}
      {kind !== 'dumbbell' && <View style={{ minHeight: H + 30, justifyContent: 'center' }}>
        {kind === 'barbell' && <BarbellView kg={kg} unit={unit} />}
        {kind === 'kettlebell' && <KettlebellView kg={kg} unit={unit} count={count} />}
        {kind === 'stack' && <StackView kg={kg} unit={unit} onPick={onChange} pulse={pulse} />}
        {kind === 'bodyweight' && (
          <View style={{ alignItems: 'center', gap: space.sm }}>
            <Icon name="figure.strengthtraining.traditional" size={64} color={colors.cyan} weight="light" />
            <T v="label" color={colors.dim} style={{ textAlign: 'center' }}>{bodyText ?? (kg > 0 ? 'Body weight plus added load' : 'Body weight')}</T>
          </View>
        )}
      </View>}
      <Row style={{ justifyContent: 'space-between' }}>
        <Press onPress={() => set(display - step)} style={styles.bigStep} hitSlop={6}><Icon name="minus" size={20} /></Press>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Row gap={6} style={{ alignItems: 'baseline', justifyContent: 'center' }}>
            <TextInput
              value={text ?? label}
              onFocus={() => setText(kind === 'bodyweight' && kg === 0 ? '' : formatNum(display))}
              onChangeText={setText}
              onBlur={() => {
                const n = parseFloat((text ?? '').replace(',', '.'));
                if (Number.isFinite(n)) set(n);
                setText(null);
              }}
              keyboardType="decimal-pad"
              selectTextOnFocus
              style={[type.hero as any, (() => {
                // Sized to its digits so "102.5" never loses a character.
                const len = String(text ?? label).length;
                const size = len <= 3 ? 64 : len === 4 ? 56 : 46;
                // Letters ("BW", "Band") are wider than digits.
                const per = /^[+\d.,]*$/.test(String(text ?? label)) ? 0.64 : 0.86;
                return { color: colors.text, textAlign: 'center', fontSize: size, lineHeight: size * 1.15, width: Math.max(90, len * size * per + 16), padding: 0 };
              })()]}
            />
            <T v="headline" color={colors.dim}>{unit}</T>
          </Row>
          <T v="caption" color={colors.faint}>{paired ? `each · ± ${step} ${unit}` : bodyPart !== null && kind === 'bodyweight' && !body?.band ? `added ${formatNum(display)} ${unit} · ± ${step} ${unit}` : `± ${step} ${unit}`}</T>
        </View>
        <Press onPress={() => set(display + step)} style={styles.bigStep} hitSlop={6}><Icon name="plus" size={20} /></Press>
      </Row>
      {paired && onCount && (
        <Segmented
          options={[{ value: 1, label: kind === 'dumbbell' ? 'One dumbbell' : 'One kettlebell' }, { value: 2, label: kind === 'dumbbell' ? 'Two dumbbells' : 'Two kettlebells' }]}
          value={count}
          onChange={(n) => onCount(n as 1 | 2)}
        />
      )}
      <Segmented
        options={[{ value: 'kg', label: 'Kilograms' }, { value: 'lb', label: 'Pounds' }]}
        value={unit}
        onChange={(u) => {
          tap();
          // Snap to what the new unit's plates or dumbbells can actually make.
          const to = u as Unit;
          const v = toDisplay(kg, to);
          const snap = kind === 'barbell' ? (to === 'kg' ? 2.5 : 5) : kind === 'dumbbell' ? dumbbellStep(to, v) : to === 'kg' ? 0.5 : 1;
          onChange(toKg(roundTo(v, snap), to));
          onUnit(to);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  barWrap: { height: H + 10, justifyContent: 'center' },
  shaft: { position: 'absolute', left: '22%', right: '22%', height: 8, borderRadius: 4, backgroundColor: '#8D99AB' },
  knurl: { position: 'absolute', left: '40%', right: '40%', height: 8, borderRadius: 2, backgroundColor: '#6E7A8C' },
  sleeve: { position: 'absolute', width: '30%', height: H + 10, justifyContent: 'center' },
  sleeveRod: { position: 'absolute', height: 14, borderRadius: 3, backgroundColor: '#B7C0CC' },
  stack: { flexDirection: 'row', alignItems: 'center', height: H + 10, paddingHorizontal: 6 },
  collar: { position: 'absolute', width: 8, height: 26, borderRadius: 3, backgroundColor: '#D6DCE5' },
  plate: { borderRadius: 4, marginHorizontal: 0.75, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  plateShine: { position: 'absolute', left: 2, width: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.22)' },
  lbRim: { ...StyleSheet.absoluteFill, borderRadius: 4, borderWidth: 2, borderColor: 'rgba(255,255,255,0.08)' },
  dbPlate: { width: 12, borderRadius: 4, marginHorizontal: 0.75, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.1)' },
  dbCap: { width: 6, height: 20, borderRadius: 2, backgroundColor: '#B7C0CC' },
  dbHandle: { width: 66, height: 11, borderRadius: 6, backgroundColor: '#8D99AB', alignItems: 'center', justifyContent: 'center' },
  dbGrip: { width: 36, height: 11, borderRadius: 3, backgroundColor: '#6E7A8C' },
  kbHandle: { borderWidth: 9, borderColor: '#26344F', borderBottomWidth: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  kbBody: { backgroundColor: '#1E2A40', alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairlineStrong },
  stackPlate: {
    width: 170, height: PLATE, marginBottom: GAP, borderRadius: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10,
    backgroundColor: '#1A1D24', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.10)', borderTopColor: 'rgba(255,255,255,0.18)',
  },
  plateNum: { width: 34, fontSize: 11, fontWeight: '800', color: colors.faint, fontVariant: ['tabular-nums'] },
  hole: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#0B0D11', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.15)' },
  rod: { width: 6, height: 18, borderRadius: 3, backgroundColor: '#8A93A3' },
  cap: { width: 120, height: 26, borderRadius: 8, marginBottom: GAP, backgroundColor: '#2B303A', alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.16)' },
  addOn: { minWidth: 34, height: 18, paddingHorizontal: 6, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface3 },
  pin: { position: 'absolute', top: (PLATE - 14) / 2, left: 105 - 7, flexDirection: 'row', alignItems: 'center' },
  pinHead: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.lime, borderWidth: 2, borderColor: '#E9FFC2' },
  pinShaft: { width: 56, height: 8, marginLeft: -2, borderTopRightRadius: 4, borderBottomRightRadius: 4, backgroundColor: '#C9CED8' },
  bigStep: { width: 52, height: 52, borderRadius: radius.pill, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline },
});

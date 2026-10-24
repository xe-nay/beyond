// Load visuals for the active set: plates stacking onto a barbell, one or two dumbbells that move
// like the exercise, a kettlebell, a machine weight stack. Switching kg/lb reloads with that unit's
// own plates and snaps to a weight they can make.
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated, {
  Easing, LinearTransition, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';

import type { LoadKind } from '../catalog';
import { BARS, dumbbellStep, loadBarbell, roundTo, toDisplay, toKg, type Plate } from '../domain/plates';
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
export function StackView({ kg, unit }: { kg: number; unit: Unit }) {
  const v = toDisplay(kg, unit);
  const step = unit === 'kg' ? 5 : 10;
  const n = 14;
  const pin = Math.min(n, Math.max(1, Math.round(v / step)));
  return (
    <View style={{ alignItems: 'center', gap: 3 }}>
      {Array.from({ length: n }, (_, i) => {
        const active = i < pin;
        return <View key={i} style={[styles.stackPlate, active && { backgroundColor: alpha(colors.cyan, 0.18 + 0.5 * (i / n)), borderColor: alpha(colors.cyan, 0.5) }]} />;
      })}
      <Animated.View style={[styles.pin, { top: (pin - 1) * 9 - 2, transitionProperty: 'top', transitionDuration: 220 } as any]} />
    </View>
  );
}

const formatNum = (v: number) => (Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(1));

/** The weight picker shown in a workout: visual + number + steps + kg/lb switch (+ one/two for dumbbells). */
export function WeightControl({ kg, onChange, unit, onUnit, kind, pulse, count = 1, onCount, motion }: {
  kg: number; onChange: (kg: number) => void; unit: Unit; onUnit: (u: Unit) => void; kind: LoadKind; pulse?: number;
  count?: 1 | 2; onCount?: (n: 1 | 2) => void; motion?: Motion;
}) {
  const display = toDisplay(kg, unit);
  const step = kind === 'barbell' ? (unit === 'kg' ? 2.5 : 5) : kind === 'dumbbell' ? dumbbellStep(unit, display) : kind === 'kettlebell' ? (unit === 'kg' ? 4 : 5) : unit === 'kg' ? 2.5 : 5;
  const [text, setText] = useState<string | null>(null);
  const set = (d: number) => onChange(Math.max(0, toKg(roundTo(d, unit === 'kg' ? 0.25 : 0.5), unit)));
  const label = kind === 'bodyweight' ? (kg > 0 ? `+${formatNum(display)}` : 'BW') : formatNum(display);
  const paired = kind === 'dumbbell' || kind === 'kettlebell';

  return (
    <View style={{ gap: space.lg }}>
      <View style={{ minHeight: H + 30, justifyContent: 'center' }}>
        {kind === 'barbell' && <BarbellView kg={kg} unit={unit} />}
        {kind === 'dumbbell' && <DumbbellView kg={kg} unit={unit} pulse={pulse} count={count} motion={motion} />}
        {kind === 'kettlebell' && <KettlebellView kg={kg} unit={unit} count={count} />}
        {kind === 'stack' && <StackView kg={kg} unit={unit} />}
        {kind === 'bodyweight' && (
          <View style={{ alignItems: 'center', gap: space.sm }}>
            <Icon name="figure.strengthtraining.traditional" size={64} color={colors.cyan} weight="light" />
            <T v="label" color={colors.dim}>{kg > 0 ? 'Body weight plus added load' : 'Body weight'}</T>
          </View>
        )}
      </View>
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
              style={[type.hero as any, { color: colors.text, textAlign: 'center', width: 150, padding: 0 }]}
            />
            <T v="headline" color={colors.dim}>{unit}</T>
          </Row>
          <T v="caption" color={colors.faint}>{paired ? `each · ± ${step} ${unit}` : `± ${step} ${unit}`}</T>
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
  stackPlate: { width: 130, height: 6, borderRadius: 2, backgroundColor: colors.surface3, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline },
  pin: { position: 'absolute', right: -14, width: 22, height: 10, borderRadius: 5, backgroundColor: colors.lime },
  bigStep: { width: 52, height: 52, borderRadius: radius.pill, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline },
});

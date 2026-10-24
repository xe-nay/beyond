import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { macroSplit } from '../domain/nutrition';
import type { Nutrients } from '../domain/types';
import { alpha, colors, radius, type } from '../theme';
import { Row, T } from './ui';

const ACircle = Animated.createAnimatedComponent(Circle);
const EASE = Easing.bezier(0.23, 1, 0.32, 1);

function Arc({ size, stroke, start, length, color }: { size: number; stroke: number; start: number; length: number; color: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const reduced = useReducedMotion();
  const v = useSharedValue(0);
  useEffect(() => {
    v.set(reduced ? length : withTiming(length, { duration: 650, easing: EASE }));
  }, [length, reduced]);
  const props = useAnimatedProps(() => ({ strokeDasharray: [Math.max(0, v.get() * c - 3), c] as any }));
  return (
    <ACircle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="butt"
      animatedProps={props} rotation={-90 + start * 360} origin={`${size / 2}, ${size / 2}`} />
  );
}

/** Calorie donut split into protein / carbs / fat by energy share, with the calories in the middle. */
export function MacroDonut({ n, size = 150, label = 'kcal' }: { n: Nutrients; size?: number; label?: string }) {
  const split = macroSplit(n);
  const empty = n.protein + n.carbs + n.fat === 0;
  const stroke = 12;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={(size - stroke) / 2} stroke={colors.surface3} strokeWidth={stroke} fill="none" />
        {!empty && (
          <>
            <Arc size={size} stroke={stroke} start={0} length={split.protein} color={colors.protein} />
            <Arc size={size} stroke={stroke} start={split.protein} length={split.carbs} color={colors.carbs} />
            <Arc size={size} stroke={stroke} start={split.protein + split.carbs} length={split.fat} color={colors.fat} />
          </>
        )}
      </Svg>
      <CountUp value={n.kcal} style={[type.big, { color: colors.text }]} />
      <T v="caption" color={colors.faint}>{label}</T>
    </View>
  );
}

/** Animates a number change (no animation with reduced motion). */
export function CountUp({ value, style, decimals = 0 }: { value: number; style?: any; decimals?: number }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (reduced) return setShown(value);
    const from = shown;
    const start = Date.now();
    let raf = 0;
    const step = () => {
      const t = Math.min(1, (Date.now() - start) / 420);
      const e = 1 - Math.pow(1 - t, 3);
      setShown(from + (value - from) * e);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <T style={style}>{shown.toFixed(decimals)}</T>;
}

export function MacroLegend({ n, targets }: { n: Nutrients; targets?: { protein: number; carbs: number; fat: number } }) {
  const items: [string, number, string, number | undefined][] = [
    ['Protein', n.protein, colors.protein, targets?.protein],
    ['Carbs', n.carbs, colors.carbs, targets?.carbs],
    ['Fat', n.fat, colors.fat, targets?.fat],
  ];
  return (
    <View style={{ gap: 12, flex: 1 }}>
      {items.map(([k, v, c, t]) => (
        <View key={k} style={{ gap: 5 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row gap={6}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c }} /><T v="label" color={colors.dim}>{k}</T></Row>
            <T v="label" style={type.num}>{Math.round(v)}{t ? <T v="label" color={colors.faint}> / {t} g</T> : ' g'}</T>
          </Row>
          {t !== undefined && (
            <View style={{ height: 5, borderRadius: 3, backgroundColor: colors.surface3, overflow: 'hidden' }}>
              <View style={[{ height: 5, borderRadius: 3, backgroundColor: c, width: `${Math.min(100, (v / t) * 100)}%`, transitionProperty: 'width', transitionDuration: 500 } as any]} />
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

const SCORE: Record<string, string> = { a: '#038141', b: '#85BB2F', c: '#FECB02', d: '#EE8100', e: '#E63E11' };
export function NutriScore({ grade }: { grade: string | null }) {
  if (!grade) return null;
  return (
    <Row gap={2} style={{ padding: 3, borderRadius: radius.sm, backgroundColor: alpha('#FFFFFF', 0.08) }}>
      {['a', 'b', 'c', 'd', 'e'].map((g) => (
        <View key={g} style={{ width: g === grade ? 24 : 16, height: g === grade ? 24 : 18, borderRadius: 5, backgroundColor: SCORE[g], opacity: g === grade ? 1 : 0.45, alignItems: 'center', justifyContent: 'center' }}>
          <T style={{ fontSize: g === grade ? 14 : 10, fontWeight: '800' }} color="#FFFFFF">{g.toUpperCase()}</T>
        </View>
      ))}
    </Row>
  );
}

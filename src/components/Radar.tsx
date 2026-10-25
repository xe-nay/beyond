// Spider chart of sets per muscle. Each spoke is a muscle; the filled shape is the work done, the
// dashed ring the target. The shape grows out from the centre when the data changes.
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, G, Line, Polygon, Text as SvgText } from 'react-native-svg';

import { alpha, colors } from '../theme';

const APolygon = Animated.createAnimatedComponent(Polygon);
const FONT = Platform.OS === 'web' ? 'Inter, system-ui, sans-serif' : undefined;

export interface Axis { key: string; label: string; value: number }

export function Radar({ axes, target, max, size, onSelect, selected }: {
  axes: Axis[]; target: number; max: number; size: number; onSelect?: (key: string) => void; selected?: string | null;
}) {
  const reduced = useReducedMotion();
  const grow = useSharedValue(0);
  const [, force] = useState(0);
  const key = axes.map((a) => `${a.key}${a.value}`).join();
  useEffect(() => {
    grow.set(0);
    grow.set(reduced ? 1 : withTiming(1, { duration: 650, easing: Easing.bezier(0.23, 1, 0.32, 1) }));
    force((n) => n + 1);
  }, [key]);

  const c = size / 2;
  const r = c - 62; // room for labels
  const n = axes.length;
  const at = (i: number, v: number) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const d = (Math.min(v, max) / max) * r;
    return [c + Math.cos(a) * d, c + Math.sin(a) * d];
  };
  const points = (vals: number[], k = 1) => vals.map((v, i) => at(i, v * k).join(',')).join(' ');
  // Plain numbers for the animation thread: each spoke's direction and its share of the radius.
  const dx = axes.map((_, i) => Math.cos(-Math.PI / 2 + (i / n) * Math.PI * 2));
  const dy = axes.map((_, i) => Math.sin(-Math.PI / 2 + (i / n) * Math.PI * 2));
  const len = axes.map((a) => (Math.min(a.value, max) / max) * r);
  const shape = useAnimatedProps(() => {
    const k = grow.get();
    let p = '';
    for (let i = 0; i < len.length; i++) p += `${c + dx[i] * len[i] * k},${c + dy[i] * len[i] * k} `;
    return { points: p.trim() };
  });
  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {/* Web of rings and spokes */}
        {rings.map((k) => <Polygon key={k} points={points(axes.map(() => max * k))} fill="none" stroke={alpha('#8CAADC', 0.14)} strokeWidth={1} />)}
        {axes.map((_, i) => {
          const [x, y] = at(i, max);
          return <Line key={i} x1={c} y1={c} x2={x} y2={y} stroke={alpha('#8CAADC', 0.12)} strokeWidth={1} />;
        })}
        {/* Target ring */}
        <Polygon points={points(axes.map(() => target))} fill="none" stroke={alpha(colors.lime, 0.55)} strokeWidth={1.2} strokeDasharray="4 4" />
        {/* Work done */}
        <APolygon animatedProps={shape} fill={alpha(colors.cyan, 0.22)} stroke={colors.cyan} strokeWidth={2} strokeLinejoin="round" />
        {axes.map((a, i) => {
          const [x, y] = at(i, a.value);
          return a.value > 0 ? <Circle key={a.key} cx={x} cy={y} r={selected === a.key ? 5 : 3} fill={a.value >= target ? colors.lime : colors.cyan} /> : null;
        })}
        {/* Labels outside the web, with the set count */}
        {axes.map((a, i) => {
          const ang = -Math.PI / 2 + (i / n) * Math.PI * 2;
          const x = c + Math.cos(ang) * (r + 24);
          const y = c + Math.sin(ang) * (r + 20);
          const on = selected === a.key;
          return (
            <G key={a.key} onPress={() => onSelect?.(a.key)}>
              <SvgText x={x} y={y - 2} fontSize={11} fontWeight="600" fontFamily={FONT} fill={on ? colors.lime : a.value ? colors.text : colors.faint} textAnchor="middle">{a.label}</SvgText>
              <SvgText x={x} y={y + 11} fontSize={10} fontFamily={FONT} fill={a.value >= target ? colors.lime : colors.dim} textAnchor="middle">{a.value % 1 ? a.value.toFixed(1) : a.value}</SvgText>
            </G>
          );
        })}
      </Svg>
    </View>
  );
}

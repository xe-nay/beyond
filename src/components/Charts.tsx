import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { colors, type } from '../theme';
import { Row, T } from './ui';

/** Smooth line with a soft fill. Last point is marked. */
export function LineChart({ data, height = 120, color = colors.cyan }: { data: number[]; height?: number; color?: string }) {
  const [w, setW] = useState(0);
  const reduced = useReducedMotion();
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const pad = 6;
  const x = (i: number) => pad + (i / (data.length - 1)) * (w - pad * 2);
  const y = (v: number) => pad + (1 - (max === min ? 0.5 : (v - min) / (max - min))) * (height - pad * 2);
  let d = `M ${x(0)} ${y(data[0])}`;
  for (let i = 1; i < data.length; i++) {
    const cx = (x(i - 1) + x(i)) / 2;
    d += ` C ${cx} ${y(data[i - 1])}, ${cx} ${y(data[i])}, ${x(i)} ${y(data[i])}`;
  }
  const area = `${d} L ${x(data.length - 1)} ${height} L ${x(0)} ${height} Z`;
  return (
    <View style={{ height }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && (
        <Animated.View entering={reduced ? undefined : FadeIn.duration(300)}>
          <Svg width={w} height={height}>
            <Defs>
              <LinearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={color} stopOpacity={0.28} />
                <Stop offset="1" stopColor={color} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Path d={area} fill="url(#fill)" />
            <Path d={d} stroke={color} strokeWidth={2.5} fill="none" strokeLinecap="round" />
            <Circle cx={x(data.length - 1)} cy={y(data[data.length - 1])} r={4.5} fill={color} />
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}

/** Vertical bars with labels; the latest bar is highlighted. */
export function BarChart({ data, labels, height = 120, color = colors.cyan, format = (v: number) => String(v) }: { data: number[]; labels: string[]; height?: number; color?: string; format?: (v: number) => string }) {
  const [w, setW] = useState(0);
  const max = Math.max(1, ...data);
  const gap = 8;
  const bw = w ? (w - gap * (data.length - 1)) / data.length : 0;
  return (
    <View style={{ gap: 6 }}>
      <View style={{ height }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {w > 0 && (
          <Svg width={w} height={height}>
            {data.map((v, i) => {
              const h = Math.max(3, (v / max) * (height - 18));
              const last = i === data.length - 1;
              return <Rect key={i} x={i * (bw + gap)} y={height - h} width={bw} height={h} rx={Math.min(6, bw / 2)} fill={last ? color : colors.surface3} />;
            })}
          </Svg>
        )}
      </View>
      <Row gap={gap} style={{ justifyContent: 'space-between' }}>
        {labels.map((l, i) => (
          <T key={i} v="caption" color={i === labels.length - 1 ? colors.text : colors.faint} style={[{ flex: 1, textAlign: 'center', fontSize: 9, letterSpacing: 0 }, type.num]}>{l}</T>
        ))}
      </Row>
      <T v="caption" color={colors.faint} style={{ textTransform: 'none', letterSpacing: 0 }}>Peak {format(max)}</T>
    </View>
  );
}

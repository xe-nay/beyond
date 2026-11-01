// The cable attachments as they look from the front, hanging from the cable's hook: the black handles
// with grips pointing forward (a round end cap, palms facing each other), from wide to close, then the
// chrome straight bar and the lat bar with angled ends (grips along the bar). Tap one to use it.
import { ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';

import { ATTACHMENTS, attachment, type Attachment } from '../domain/attachments';
import { alpha, colors, radius, space } from '../theme';
import { Press, T } from './ui';

const W = 72;
const C = W / 2;
// Half the distance between the grips, to scale with the rack: wide, medium, narrow, close, V-grip.
const SPAN: Record<string, number> = { 'neutral-wide': 31, 'neutral-medium': 24, 'neutral-shoulder': 18, 'neutral-close': 11, 'v-handle': 5 };

export function AttachmentIcon({ id, color, size = 56 }: { id: string; color: string; size?: number }) {
  const h = SPAN[id];
  const stroke = { stroke: color, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const hook = (
    <>
      <Circle cx={C} cy={4} r={2.6} {...stroke} strokeWidth={1.5} />
      <Line x1={C} y1={6.6} x2={C} y2={11} {...stroke} strokeWidth={1.5} />
    </>
  );
  let body;
  if (h) {
    // Arms sloping down from the hook, then a grip pointing at you on each side.
    const v = id === 'v-handle';
    const y = v ? 25 : 22;
    const arm = v ? `M${C - h} ${y} L${C} 11 L${C + h} ${y}` : `M${C - h} ${y} L${C - h * 0.8} ${y - 3} L${C} 11 L${C + h * 0.8} ${y - 3} L${C + h} ${y}`;
    body = (
      <>
        <Path d={arm} {...stroke} strokeWidth={3.2} />
        {[C - h, C + h].map((x) => (
          <G key={x}>
            <Line x1={x} y1={y} x2={x} y2={y + 7} {...stroke} strokeWidth={5.5} />
            <Circle cx={x} cy={y + 9} r={2.4} fill={colors.surface2} stroke={color} strokeWidth={1.4} />
          </G>
        ))}
      </>
    );
  } else if (id === 'straight-bar') {
    body = (
      <>
        <Line x1={C} y1={11} x2={C} y2={16} {...stroke} strokeWidth={1.5} />
        <Line x1={4} y1={16} x2={W - 4} y2={16} {...stroke} strokeWidth={2.4} />
        <Line x1={4} y1={16} x2={16} y2={16} {...stroke} strokeWidth={5.5} />
        <Line x1={W - 16} y1={16} x2={W - 4} y2={16} {...stroke} strokeWidth={5.5} />
      </>
    );
  } else {
    // Lat bar: straight in the middle, the ends angled down where the hands go.
    body = (
      <>
        <Line x1={C} y1={11} x2={C} y2={15} {...stroke} strokeWidth={1.5} />
        <Path d={`M4 27 L14 15 L${W - 14} 15 L${W - 4} 27`} {...stroke} strokeWidth={2.4} />
        <Line x1={5} y1={26} x2={12} y2={17.5} {...stroke} strokeWidth={5.5} />
        <Line x1={W - 12} y1={17.5} x2={W - 5} y2={26} {...stroke} strokeWidth={5.5} />
      </>
    );
  }
  return (
    <Svg width={size} height={(size * 36) / W} viewBox={`0 0 ${W} 36`}>
      {hook}
      {body}
    </Svg>
  );
}

function Group({ title, items, value, onChange }: { title: string; items: Attachment[]; value: string | undefined; onChange: (id: string) => void }) {
  return (
    <View style={{ gap: 6 }}>
      <T v="footnote" color={colors.faint}>{title}</T>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {items.map((a) => {
          const on = a.id === value;
          return (
            <Press key={a.id} onPress={() => onChange(a.id)} label={a.full} style={[styles.chip, on && styles.on]}>
              <AttachmentIcon id={a.id} color={on ? colors.cyan : colors.text} />
              <T v="label" color={on ? colors.cyan : colors.dim} numberOfLines={1} style={{ fontWeight: on ? '600' : '400' }}>{a.name}</T>
            </Press>
          );
        })}
      </View>
    </View>
  );
}

export function AttachmentPicker({ value, onChange }: { value: string | undefined; onChange: (id: string) => void }) {
  const picked = attachment(value);
  const [name, detail] = (picked?.full ?? '').split(' · ');
  return (
    <View style={{ gap: space.sm }}>
      <T v="caption" color={colors.faint}>Attachment</T>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.lg }}>
        <Group title="Parallel grip" items={ATTACHMENTS.filter((a) => a.group === 'parallel')} value={value} onChange={onChange} />
        <Group title="Bar" items={ATTACHMENTS.filter((a) => a.group === 'bar')} value={value} onChange={onChange} />
      </ScrollView>
      {picked && (
        <T v="footnote" color={colors.dim}>
          <T v="footnote" color={colors.text} style={{ fontWeight: '600' }}>{name}</T>{detail ? `  ${detail}` : ''}
        </T>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { width: 74, alignItems: 'center', gap: 4, paddingTop: space.sm, paddingBottom: 6, borderRadius: radius.md, backgroundColor: colors.surface2, borderWidth: 1, borderColor: 'transparent' },
  on: { borderColor: colors.cyan, backgroundColor: alpha(colors.cyan, 0.1) },
});

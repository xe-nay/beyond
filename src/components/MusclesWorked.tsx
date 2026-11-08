// What an exercise works, at the bottom of it in a workout: the body from the front and the back with the
// main muscles lit and the supporting ones dim, the same muscles as labels, the anatomy behind them,
// and for pulling exercises the back in detail (lats, teres, traps, rear delts…), set by the grip and
// attachment chosen, with the studies it comes from (domain/backFocus.ts).
import { View } from 'react-native';

import { BACK_PART_NAMES, backFocus, type BackPart } from '../domain/backFocus';
import { REGION_NAMES } from '../domain/calc';
import type { Exercise, Region } from '../domain/types';
import { alpha, colors, radius, space } from '../theme';
import { BodyMap } from './BodyMap';
import { Card, Row, T } from './ui';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Where each part of the back sits on the body map.
const REGION_OF: Record<BackPart, Region> = {
  lats: 'upper-back', teres: 'upper-back', midTraps: 'upper-back', lowerTraps: 'trapezius', upperTraps: 'trapezius',
  rearDelts: 'deltoids', biceps: 'biceps', lowerBack: 'lower-back',
};
const LEVEL = ['', 'Helps', 'Works hard', 'Leads'];

function Tag({ label, main }: { label: string; main: boolean }) {
  return (
    <View style={{ paddingHorizontal: space.sm, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: alpha(colors.cyan, main ? 0.18 : 0.07) }}>
      <T v="label" color={main ? colors.cyan : colors.dim}>{label}</T>
    </View>
  );
}

/** Three segments filled to the part's level. */
function Level({ n }: { n: number }) {
  return (
    <Row gap={3}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={{ width: 22, height: 6, borderRadius: 3, backgroundColor: i <= n ? (n === 3 ? colors.cyan : alpha(colors.cyan, n === 2 ? 0.6 : 0.35)) : colors.surface3 }} />
      ))}
    </Row>
  );
}

export function MusclesWorked({ e, attachment }: { e: Exercise; attachment?: string }) {
  const back = backFocus(e, attachment);
  // A pulling exercise's map follows its back breakdown: what leads is lit, the rest dim.
  const primary = back ? [...new Set(back.parts.filter(([, l]) => l === 3).map(([p]) => REGION_OF[p]))] : e.primary;
  const secondary = (back
    ? [...new Set([...back.parts.filter(([, l]) => l < 3).map(([p]) => REGION_OF[p]), ...e.secondary])]
    : e.secondary).filter((r) => !primary.includes(r)) as Region[];
  if (!primary.length && !secondary.length) return null;
  return (
    <Card style={{ gap: space.md }}>
      <T v="caption" color={colors.faint}>Muscles worked</T>
      <BodyMap primary={primary} secondary={secondary} showBoth toggle={false} scale={0.62} />
      <View style={{ gap: space.sm }}>
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          {primary.map((r) => <Tag key={r} label={REGION_NAMES[r]} main />)}
          {secondary.map((r) => <Tag key={r} label={REGION_NAMES[r]} main={false} />)}
        </Row>
        {e.muscles.length > 0 && <T v="footnote" color={colors.faint}>{e.muscles.map(cap).join(' · ')}</T>}
      </View>
      {back && (
        <View style={{ gap: space.sm, paddingTop: space.sm, borderTopWidth: 0.5, borderTopColor: colors.hairline }}>
          <T v="caption" color={colors.faint}>Back in detail</T>
          {back.parts.map(([part, level]) => (
            <Row key={part} style={{ justifyContent: 'space-between' }}>
              <T v="label" color={level === 3 ? colors.text : colors.dim} style={{ flex: 1 }}>{BACK_PART_NAMES[part]}</T>
              <T v="footnote" color={colors.faint} style={{ width: 78, textAlign: 'right', marginRight: space.sm }}>{LEVEL[level]}</T>
              <Level n={level} />
            </Row>
          ))}
          <T v="footnote" color={colors.dim}>{back.note}</T>
          <T v="footnote" color={colors.faint}>{back.source}</T>
        </View>
      )}
    </Card>
  );
}

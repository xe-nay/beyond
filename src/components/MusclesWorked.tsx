// What an exercise works, at the bottom of it in a workout: the body from the front and the back with the
// main muscles lit and the supporting ones dim, the same muscles as labels, the anatomy behind them,
// and for cable pulldowns and rows what the chosen attachment changes.
import { View } from 'react-native';

import { attachmentFocus } from '../domain/attachments';
import { REGION_NAMES } from '../domain/calc';
import type { Exercise, Region } from '../domain/types';
import { alpha, colors, radius, space } from '../theme';
import { BodyMap } from './BodyMap';
import { Card, Row, T } from './ui';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Tag({ label, main }: { label: string; main: boolean }) {
  return (
    <View style={{ paddingHorizontal: space.sm, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: alpha(colors.cyan, main ? 0.18 : 0.07) }}>
      <T v="label" color={main ? colors.cyan : colors.dim}>{label}</T>
    </View>
  );
}

export function MusclesWorked({ e, attachment }: { e: Exercise; attachment?: string }) {
  const focus = attachmentFocus(attachment);
  const primary = e.primary;
  // A grip that brings a muscle in more shows it among the supporting ones.
  const secondary = [...new Set([...e.secondary, ...(focus?.more ?? [])])].filter((r) => !primary.includes(r)) as Region[];
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
        {focus && <T v="footnote" color={colors.dim}>{focus.note}</T>}
      </View>
    </Card>
  );
}

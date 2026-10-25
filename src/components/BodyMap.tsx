import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import Body, { type ExtendedBodyPart, type Slug } from 'react-native-body-highlighter';

import { REGION_NAMES } from '../domain/calc';
import type { Region } from '../domain/types';
import { alpha, colors, space } from '../theme';
import { PageDots, Row, Segmented, T } from './ui';

const SKIN: Slug[] = ['head', 'hair', 'hands', 'feet', 'ankles', 'knees'];
const ALL: Slug[] = [...SKIN, 'abs', 'adductors', 'biceps', 'calves', 'chest', 'deltoids', 'forearm', 'gluteal', 'hamstring', 'lower-back', 'neck', 'obliques', 'quadriceps', 'tibialis', 'trapezius', 'triceps', 'upper-back'];
const BACK: Region[] =['trapezius', 'upper-back', 'lower-back', 'gluteal', 'hamstring', 'triceps', 'calves'];

/** Front/back muscle map. Either primary/secondary targets, or a heat value per region (0–1). */
export function BodyMap({ primary = [], secondary = [], heat, onSelect, selected, scale = 0.9, toggle = true, showBoth = false, only }: {
  primary?: Region[]; secondary?: Region[]; heat?: Partial<Record<Region, number>>; onSelect?: (r: Region) => void; selected?: Region | null; scale?: number; toggle?: boolean; showBoth?: boolean; only?: 'front' | 'back';
}) {
  const prefersBack = [...primary].some((r) => BACK.includes(r)) && !primary.some((r) => !BACK.includes(r));
  const [side, setSide] = useState<'front' | 'back'>(prefersBack ? 'back' : 'front');

  // The library's own parts carry a hard-coded grey that beats `defaultFill`, so every part gets
  // an explicit fill: navy at rest, cyan by intensity, lime for the selected muscle.
  const palette = heat
    ? [alpha(colors.cyan, 0.22), alpha(colors.cyan, 0.38), alpha(colors.cyan, 0.55), alpha(colors.cyan, 0.75), colors.cyan, colors.lime]
    : [alpha(colors.cyan, 0.35), colors.cyan, colors.lime];
  const level = new Map<string, number>();
  if (heat) (Object.entries(heat) as [Region, number][]).forEach(([r, v]) => v > 0 && level.set(r, Math.max(1, Math.min(5, Math.ceil(v * 5)))));
  else {
    secondary.forEach((r) => level.set(r, 1));
    primary.forEach((r) => level.set(r, 2));
  }
  if (selected) level.set(selected, heat ? 6 : 3);
  const data: ExtendedBodyPart[] = ALL.map((slug) => {
    const l = level.get(slug);
    const fill = l ? palette[l - 1] : SKIN.includes(slug) ? '#1B2740' : '#141E31';
    return { slug, styles: { fill, stroke: alpha('#8CAADC', 0.22), strokeWidth: 0.6 } };
  });

  const body = (s: 'front' | 'back') => (
    <Body
      data={data}
      side={s}
      scale={scale}
      colors={palette}
      border={alpha('#8CAADC', 0.25)}
      defaultFill="#141E31"
      defaultStroke={alpha('#8CAADC', 0.25)}
      defaultStrokeWidth={0.6}
      onBodyPartPress={(b) => b.slug && b.slug in REGION_NAMES && onSelect?.(b.slug as Region)}
    />
  );

  if (only) return body(only);

  return (
    <View style={{ alignItems: 'center', gap: space.md }}>
      {showBoth ? (
        <Row gap={0} style={{ justifyContent: 'center' }}>{body('front')}{body('back')}</Row>
      ) : (
        body(side)
      )}
      {toggle && !showBoth && (
        <Segmented style={{ width: 200 }} options={[{ value: 'front', label: 'Front' }, { value: 'back', label: 'Back' }]} value={side} onChange={(v) => setSide(v as 'front' | 'back')} />
      )}
      {!heat && (primary.length > 0 || secondary.length > 0) && (
        <Row gap={space.lg}>
          <Legend color={colors.cyan} label="Primary" />
          {secondary.length > 0 && <Legend color={alpha(colors.cyan, 0.35)} label="Supporting" />}
        </Row>
      )}
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <Row gap={6}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <T v="label" color={colors.dim}>{label}</T>
    </Row>
  );
}

/** Front and back as two pages: swipe sideways to turn the body around. */
export function SwipeBody({ width, ...props }: { width: number; heat?: Partial<Record<Region, number>>; primary?: Region[]; onSelect?: (r: Region) => void; selected?: Region | null }) {
  const [page, setPage] = useState(0);
  const scale = Math.min(1.25, width / 260);
  return (
    <View style={{ width, gap: space.sm }}>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} scrollEventThrottle={32} onScroll={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}>
        {(['front', 'back'] as const).map((side) => (
          <View key={side} style={{ width, alignItems: 'center' }}>
            <BodyMap {...props} only={side} scale={scale} />
          </View>
        ))}
      </ScrollView>
      <Row style={{ justifyContent: 'center' }} gap={space.sm}>
        <T v="footnote" color={colors.faint}>{page ? 'Back' : 'Front'}</T>
        <PageDots count={2} index={page} color={colors.cyan} />
      </Row>
    </View>
  );
}

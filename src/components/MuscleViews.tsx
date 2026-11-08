// The Progress body in three views: Worked (sets in the period), Fatigue (recent hard sets and a recovery
// estimate) and Strength (estimated 1RM, last 4 weeks against the 4 before). Each colours the body, lists
// every muscle with its figure, and shows the details of the muscle tapped (domain/muscles.ts).
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { byId, exercise } from '../catalog';
import { groupByExercise, REGION_NAMES, REGIONS, working } from '../domain/calc';
import { muscleFatigue, muscleStrength, type Readiness } from '../domain/muscles';
import { formatWeight } from '../domain/plates';
import type { Region, Session } from '../domain/types';
import { alpha, colors, radius, space, type } from '../theme';
import { SwipeBody } from './BodyMap';
import { Card, Chip, Press, Row, Segmented, T } from './ui';

type View3 = 'worked' | 'fatigue' | 'strength';
const STATUS: Record<Readiness, { label: string; color: string }> = {
  fatigued: { label: 'Fatigued', color: colors.amber },
  recovering: { label: 'Recovering', color: colors.cyan },
  fresh: { label: 'Fresh', color: colors.lime },
};
const HOUR = 3600000;
const ago = (t: number, now: number) => {
  const h = (now - t) / HOUR;
  return h < 1 ? 'under an hour ago' : h < 36 ? `${Math.round(h)} h ago` : `${Math.round(h / 24)} days ago`;
};
const pct = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;

export function MuscleViews({ done, inRange, sets, width, unit }: { done: Session[]; inRange: Session[]; sets: Record<Region, number>; width: number; unit: 'kg' | 'lb' }) {
  const [view, setView] = useState<View3>('worked');
  const [region, setRegion] = useState<Region | null>(null);
  // The time the screen opened: render stays pure.
  const [now] = useState(() => Date.now());
  const fatigue = useMemo(() => muscleFatigue(done, byId, now), [done, now]);
  const strength = useMemo(() => muscleStrength(done, byId, now), [done, now]);
  const regions = REGIONS.filter((r) => r !== 'neck');

  // What colours the body in each view: share of the most-worked muscle, recent load, gains.
  const maxSets = Math.max(1, ...regions.map((r) => sets[r]));
  const maxGain = Math.max(0.01, ...regions.map((r) => strength[r].change ?? 0));
  const heat = Object.fromEntries(regions.map((r) => [r,
    view === 'worked' ? sets[r] / maxSets
      : view === 'fatigue' ? fatigue[r].load
        : Math.max(0, strength[r].change ?? 0) / maxGain,
  ])) as Record<Region, number>;

  // Every muscle with its figure, most relevant first.
  const rows = regions
    .map((r) => {
      if (view === 'worked') return { r, sort: sets[r], value: `${sets[r].toFixed(1)} sets`, color: sets[r] ? colors.cyan : colors.faint };
      if (view === 'fatigue') {
        const f = fatigue[r];
        return { r, sort: f.lastAt ? 2 + f.load - (f.status === 'fresh' ? 1 : 0) : 0, value: f.lastAt ? STATUS[f.status].label : 'Not trained lately', color: f.lastAt ? STATUS[f.status].color : colors.faint };
      }
      const c = strength[r].change;
      return { r, sort: c === null ? -9 : c, value: c === null ? 'Not enough data' : pct(c), color: c === null ? colors.faint : c >= 0 ? colors.lime : colors.amber };
    })
    .sort((a, b) => b.sort - a.sort);

  const caption = view === 'worked'
    ? 'Working sets in the period: the main muscle counts 1, a supporting one ½ (an approximation).'
    : view === 'fatigue'
      ? 'Hard sets in the last 72 h. Recovery usually takes 24–72 h, longer after sets at 0–1 RIR or high volume (Morán-Navarro 2017). An estimate.'
      : 'Best estimated 1RM per lift, last 4 weeks against the 4 before; lifts done in both count, weighted by sets.';

  return (
    <Card style={{ alignItems: 'center', gap: space.md }}>
      <Segmented<View3> style={{ alignSelf: 'stretch' }} value={view} onChange={(v) => { setView(v); }}
        options={[{ value: 'worked', label: 'Worked' }, { value: 'fatigue', label: 'Fatigue' }, { value: 'strength', label: 'Strength' }]} />
      <SwipeBody width={width} heat={heat} onSelect={setRegion} selected={region} onClear={() => setRegion(null)} />
      {region ? <Detail view={view} region={region} onClose={() => setRegion(null)} sets={sets} inRange={inRange} fatigue={fatigue} strength={strength} now={now} unit={unit} /> : (
        <T v="footnote" color={colors.faint} style={{ textAlign: 'center' }}>{caption}</T>
      )}
      <View style={{ alignSelf: 'stretch' }}>
        {rows.map(({ r, value, color }) => (
          <Press key={r} onPress={() => setRegion(r === region ? null : r)} haptic={false} label={`${REGION_NAMES[r]}: ${value}`}>
            <Row style={{ paddingVertical: space.sm, borderTopWidth: 0.5, borderTopColor: colors.hairline, backgroundColor: r === region ? alpha(colors.cyan, 0.06) : undefined }}>
              <T v="label" color={r === region ? colors.text : colors.dim} style={{ flex: 1 }}>{REGION_NAMES[r]}</T>
              <T v="label" color={color} style={[type.num, { fontWeight: '600' }]}>{value}</T>
            </Row>
          </Press>
        ))}
      </View>
    </Card>
  );
}

function Detail({ view, region, onClose, sets, inRange, fatigue, strength, now, unit }: {
  view: View3; region: Region; onClose: () => void; sets: Record<Region, number>; inRange: Session[];
  fatigue: ReturnType<typeof muscleFatigue>; strength: ReturnType<typeof muscleStrength>; now: number; unit: 'kg' | 'lb';
}) {
  const head = (right: string, color: string) => (
    <Row style={{ justifyContent: 'space-between' }}>
      <Row gap={space.sm}>
        <T v="headline">{REGION_NAMES[region]}</T>
        <Chip label="Show all" icon="xmark" onPress={onClose} />
      </Row>
      <T v="headline" color={color} style={type.num}>{right}</T>
    </Row>
  );
  const box = { alignSelf: 'stretch' as const, gap: 6, padding: space.md, borderRadius: radius.md, backgroundColor: colors.surface2 };

  if (view === 'worked') {
    return (
      <View style={box}>
        {head(`${sets[region].toFixed(1)} sets`, colors.cyan)}
        <T v="label" color={colors.dim}>
          {groupByExercise(inRange.flatMap((x) => working(x.sets))).filter((g) => byId[g.exerciseId]?.primary.includes(region)).map((g) => `${exercise(g.exerciseId)?.name} ×${g.sets.length}`).join(' · ') || 'No direct work in this period'}
        </T>
      </View>
    );
  }
  if (view === 'fatigue') {
    const f = fatigue[region];
    const st = STATUS[f.status];
    return (
      <View style={box}>
        {head(f.lastAt ? st.label : '—', f.lastAt ? st.color : colors.faint)}
        {f.lastAt ? (
          <>
            <T v="label" color={colors.dim}>Last trained {ago(f.lastAt, now)} · {f.hardSets} hard sets in 72 h{f.nearFailure ? ` · ${f.nearFailure} at 0–1 RIR` : ''}</T>
            <T v="label" color={st.color}>{f.freshAt && f.freshAt > now ? `Fresh again in about ${Math.max(1, Math.round((f.freshAt - now) / HOUR))} h` : 'Ready to train hard'}</T>
          </>
        ) : <T v="label" color={colors.dim}>No working sets in the last 4 days.</T>}
      </View>
    );
  }
  const s = strength[region];
  return (
    <View style={box}>
      {head(s.change === null ? '—' : pct(s.change), s.change === null ? colors.faint : s.change >= 0 ? colors.lime : colors.amber)}
      {s.lifts.length ? s.lifts.map((l) => (
        <Row key={l.exerciseId} style={{ justifyContent: 'space-between' }}>
          <T v="label" color={colors.dim} style={{ flex: 1 }} numberOfLines={1}>{exercise(l.exerciseId)?.name}</T>
          <T v="label" color={colors.dim} style={type.num}>{formatWeight(l.before, unit)} → {formatWeight(l.after, unit)} {unit}  </T>
          <T v="label" color={l.change >= 0 ? colors.lime : colors.amber} style={[type.num, { width: 58, textAlign: 'right' }]}>{pct(l.change)}</T>
        </Row>
      )) : <T v="label" color={colors.dim}>Needs lifts for this muscle in both the last 4 weeks and the 4 before.</T>}
    </View>
  );
}

import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';

import { byId, exercise } from '../../../src/catalog';
import { SwipeBody } from '../../../src/components/BodyMap';
import { ExerciseImage } from '../../../src/components/ExerciseImage';
import { Radar } from '../../../src/components/Radar';
import { BarChart, LineChart } from '../../../src/components/Charts';
import { Icon } from '../../../src/components/Icon';
import { Button, Card, Chip, Press, Row, Screen, Section, Segmented, Stat, T } from '../../../src/components/ui';
import {
  effortSummary, fatigueReport, groupByExercise, regionSets, REGION_NAMES, REGIONS, repDrop, rirToRpe, sessionMinutes, strengthTrend, volumeLoad, weekStart, weeklySeries, working,
} from '../../../src/domain/calc';
import { formatClock } from '../../../src/domain/intervals';
import { formatWeight, toDisplay } from '../../../src/domain/plates';
import type { Region } from '../../../src/domain/types';
import { useStore } from '../../../src/store';
import { alpha, colors, radius, space, type } from '../../../src/theme';

const LEVELS = [
  { value: 'beginner', label: 'Basic' }, { value: 'intermediate', label: 'More' }, { value: 'advanced', label: 'Deep' }, { value: 'expert', label: 'Expert' },
] as const;
const rank = { beginner: 0, intermediate: 1, advanced: 2, expert: 3 };
const DAY = 86400000;
const PERIODS = [{ value: 'week', label: 'This week' }, { value: 'last', label: 'Last week' }, { value: 'month', label: '4 weeks' }, { value: 'all', label: 'All' }] as const;
// The basic spider: muscles grouped the way most programs count them.
const GROUPS: { key: string; label: string; regions: Region[] }[] = [
  { key: 'chest', label: 'Chest', regions: ['chest'] },
  { key: 'back', label: 'Back', regions: ['upper-back', 'trapezius', 'lower-back'] },
  { key: 'shoulders', label: 'Shoulders', regions: ['deltoids'] },
  { key: 'arms', label: 'Arms', regions: ['biceps', 'triceps', 'forearm'] },
  { key: 'core', label: 'Core', regions: ['abs', 'obliques'] },
  { key: 'glutes', label: 'Glutes', regions: ['gluteal'] },
  { key: 'legs', label: 'Legs', regions: ['quadriceps', 'hamstring', 'adductors', 'calves', 'tibialis'] },
];

export default function Progress() {
  const router = useRouter();
  const s = useStore();
  const unit = s.profile.unit;
  const level = rank[s.analyticsLevel];
  const done = useMemo(() => s.sessions.filter((x) => x.finishedAt), [s.sessions]);
  const [period, setPeriod] = useState<'week' | 'last' | 'month' | 'all'>('week');
  const [region, setRegion] = useState<Region | null>(null);
  const [detail, setDetail] = useState<'basic' | 'detailed'>('basic');
  const { width } = useWindowDimensions();
  const inner = width - space.lg * 4;

  const monday = weekStart().getTime();
  const range = period === 'week' ? [monday, Date.now() + DAY] : period === 'last' ? [monday - 7 * DAY, monday] : period === 'month' ? [Date.now() - 28 * DAY, Date.now() + DAY] : [0, Date.now() + DAY];
  const inRange = done.filter((x) => { const t = Date.parse(x.finishedAt!); return t >= range[0] && t < range[1]; });
  const sets = regionSets(inRange, byId);
  const first = done.reduce((t, x) => Math.min(t, Date.parse(x.finishedAt!)), Date.now());
  const weeks = period === 'month' ? 4 : period === 'all' ? Math.max(1, Math.ceil((Date.now() - first) / (7 * DAY))) : 1;
  const volume = inRange.reduce((n, x) => n + volumeLoad(x.sets), 0);
  const minutes = inRange.reduce((n, x) => n + (sessionMinutes(x) ?? 0), 0);
  const target = 10 * weeks; // about 10 hard sets per muscle a week
  const axes = detail === 'basic'
    ? GROUPS.map((g) => ({ key: g.key, label: g.label, value: Math.round(g.regions.reduce((n, r) => n + sets[r], 0) * 10) / 10 }))
    : REGIONS.filter((r) => r !== 'neck').map((r) => ({ key: r, label: REGION_NAMES[r], value: Math.round(sets[r] * 10) / 10 }));
  const radarMax = Math.max(target * 1.4, ...axes.map((a) => a.value));
  const maxSets = Math.max(10 * weeks, ...Object.values(sets));
  const heat = Object.fromEntries(Object.entries(sets).map(([k, v]) => [k, v / maxSets])) as Record<Region, number>;

  const series = weeklySeries(done, 8);
  const consistency = series.filter((w) => w.sessions > 0).length;
  const freq = groupByExercise(done.flatMap((x) => working(x.sets))).sort((a, b) => b.sets.length - a.sets.length).slice(0, 12);
  const [lift, setLift] = useState<string | null>(null);
  const liftId = lift ?? freq[0]?.exerciseId;
  const trend = liftId ? strengthTrend(done, liftId) : [];
  const fatigue = fatigueReport(done, s.checks);
  const effort = effortSummary(inRange.flatMap((x) => x.sets));
  const recentSets = done.slice(-6).flatMap((x) => x.sets);
  const rests = working(recentSets).filter((x) => x.restSeconds !== null);
  const drops = done.slice(-6).flatMap((x) => groupByExercise(x.sets).map((g) => repDrop(g.sets))).filter(Boolean) as { percent: number }[];
  const weights = s.body.filter((b) => b.weightKg);
  const latest = [...s.body].reverse();
  const photos = s.body.filter((b) => b.photo).slice(-6).reverse();
  const cardioWeeks = Array.from({ length: 8 }, (_, i) => {
    const from = monday - (7 - i) * 7 * DAY;
    return s.cardio.filter((c) => c.completed && Date.parse(c.date) >= from && Date.parse(c.date) < from + 7 * DAY).reduce((n, c) => n + c.minutes, 0);
  });
  const weekLabels = series.map((w) => new Date(w.from).toLocaleDateString(undefined, { day: 'numeric', month: 'numeric' }));
  const tone = fatigue.status === 'Ready' ? colors.lime : fatigue.status === 'Not enough data' ? colors.dim : colors.amber;

  return (
    <Screen>
      <Segmented options={LEVELS as any} value={s.analyticsLevel} onChange={(v) => s.set({ analyticsLevel: v as any })} />

      <Segmented options={PERIODS as any} value={period} onChange={(v) => setPeriod(v as any)} />
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Stat small label="Workouts" value={inRange.length} />
          <Stat small label="Sets" value={inRange.reduce((n, x) => n + working(x.sets).length, 0)} />
          <Stat small label="Time" value={minutes >= 120 ? (minutes / 60).toFixed(1) : Math.round(minutes)} unit={minutes >= 120 ? 'h' : 'min'} />
        </Row>
        <View style={{ gap: 2 }}>
          <T v="caption" color={colors.faint}>Total volume lifted</T>
          <Row gap={6} style={{ alignItems: 'baseline' }}>
            <T v="big" color={colors.cyan} style={type.num}>{Math.round(toDisplay(volume, unit)).toLocaleString()}</T>
            <T v="headline" color={colors.dim}>{unit}</T>
          </Row>
          <T v="footnote" color={colors.faint}>Weight × reps over every working set; two dumbbells count twice. Consistency {consistency}/8 weeks.</T>
        </View>
      </Card>

      <Section title="Muscles">
        <Card style={{ alignItems: 'center' }}>
          <SwipeBody width={inner} heat={heat} onSelect={setRegion} selected={region} onClear={() => setRegion(null)} />
          {region ? (
            <View style={{ alignSelf: 'stretch', gap: 4 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Row gap={space.sm}>
                  <T v="headline">{REGION_NAMES[region]}</T>
                  <Chip label="Show all" icon="xmark" onPress={() => setRegion(null)} />
                </Row>
                <T v="headline" color={colors.cyan} style={type.num}>{sets[region].toFixed(1)} sets</T>
              </Row>
              <T v="label" color={colors.dim}>
                {groupByExercise(inRange.flatMap((x) => working(x.sets))).filter((g) => byId[g.exerciseId]?.primary.includes(region)).map((g) => `${exercise(g.exerciseId)?.name} ×${g.sets.length}`).join(' · ') || 'No direct work in this period'}
              </T>
            </View>
          ) : (
            <T v="label" color={colors.faint} style={{ textAlign: 'center' }}>Tap a muscle. Primary target = 1 set, supporting = ½ (an approximation).</T>
          )}
        </Card>
      </Section>

      <Section title="Sets per muscle" action={<Segmented style={{ width: 170 }} options={[{ value: 'basic', label: 'Basic' }, { value: 'detailed', label: 'Detailed' }]} value={detail} onChange={(v) => setDetail(v as any)} />}>
        <Card style={{ alignItems: 'center' }}>
          <Radar axes={axes} target={target} max={radarMax} size={Math.min(inner + space.lg, 380)} selected={region} onSelect={(k) => REGIONS.includes(k as Region) && setRegion(k as Region)} />
          <Row gap={space.lg}>
            <Row gap={6}><View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: alpha(colors.cyan, 0.5), borderWidth: 1.5, borderColor: colors.cyan }} /><T v="footnote" color={colors.dim}>Sets done</T></Row>
            <Row gap={6}><View style={{ width: 14, height: 0, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: colors.lime }} /><T v="footnote" color={colors.dim}>{target} sets target</T></Row>
          </Row>
        </Card>
      </Section>

      {level >= 1 && (
        <Section title="Weekly volume">
          <Card>
            <BarChart data={series.map((w) => Math.round(toDisplay(w.volume, unit)))} labels={weekLabels} format={(v) => `${v.toLocaleString()} ${unit}`} />
          </Card>
        </Section>
      )}

      <Section title="Strength">
        <Card>
          {freq.length ? (
            <>
              <LiftCarousel ids={freq.map((f) => f.exerciseId)} selected={liftId} onSelect={setLift} done={done} unit={unit} />
              {trend.length ? (
                <>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Stat small label="Estimated 1RM" value={formatWeight(trend[trend.length - 1].value, unit)} unit={unit} color={colors.cyan} />
                    {trend.length > 1 && <Stat small label="Change" value={`${trend[trend.length - 1].value >= trend[0].value ? '+' : ''}${formatWeight(trend[trend.length - 1].value - trend[0].value, unit)}`} unit={unit} color={trend[trend.length - 1].value >= trend[0].value ? colors.lime : colors.amber} />}
                  </Row>
                  <LineChart data={trend.map((t) => toDisplay(t.value, unit))} />
                  <T v="caption" color={colors.faint} style={{ textTransform: 'none', letterSpacing: 0 }}>Epley estimate from sets of 15 reps or fewer. Not a tested max.</T>
                </>
              ) : <T v="label" color={colors.faint}>Log weighted sets of 1–10 reps to see a trend.</T>}
            </>
          ) : <T v="label" color={colors.faint}>Finish a workout to start your history.</T>}
        </Card>
      </Section>

      {level >= 1 && (
        <Section title="Fatigue" action={<Press onPress={() => router.push('/check-in')}><T v="label" color={colors.cyan}>Check in</T></Press>}>
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <View>
                <T v="caption" color={colors.faint}>Last 7 days</T>
                <T v="title" color={tone}>{fatigue.status}</T>
              </View>
              <Icon name="gauge.with.dots.needle.67percent" size={30} color={tone} />
            </Row>
            {fatigue.signals.map((sig) => (
              <Row key={sig.label} style={{ alignItems: 'flex-start' }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.amber, marginTop: 7 }} />
                <View style={{ flex: 1 }}>
                  <T v="headline">{sig.label}</T>
                  <T v="label" color={colors.dim}>{sig.basis}</T>
                </View>
              </Row>
            ))}
            <Row style={{ justifyContent: 'space-between' }}>
              <Stat small label="Avg RIR" value={fatigue.effort.averageRir === null ? '—' : fatigue.effort.averageRir.toFixed(1)} unit={fatigue.effort.averageRir !== null ? `RPE ${rirToRpe(Math.round(fatigue.effort.averageRir)) ?? '≤5'}` : undefined} />
              <Stat small label="0–1 RIR" value={fatigue.effort.nearFailure} unit="sets" />
              {level >= 2 && <Stat small label="sRPE load" value={Math.round(fatigue.weeklyLoad)} unit="AU" />}
            </Row>
            {level >= 2 && (
              <T v="caption" color={colors.faint} style={{ textTransform: 'none', letterSpacing: 0 }}>
                Signals: ≥50% of rated sets at 0–1 RIR · sets ≥30% above your 4-week average · reps falling ≥25% across sets · energy ≤2, soreness ≥4 or sleep &lt;6 h in your check-in. Indicators, not a recovery measurement.
              </T>
            )}
          </Card>
        </Section>
      )}

      {level >= 2 && (
        <Section title="Rest & sets">
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <Stat small label="Avg rest" value={rests.length ? formatClock(rests.reduce((n, x) => n + x.restSeconds!, 0) / rests.length) : '—'} />
              <Stat small label="Rep drop" value={drops.length ? `${Math.round(drops.reduce((n, d) => n + d.percent, 0) / drops.length)}%` : '—'} />
              <Stat small label="Reps" value={effort.reps} />
            </Row>
            <T v="caption" color={colors.faint} style={{ textTransform: 'none', letterSpacing: 0 }}>Rest is measured between logged sets in your last 6 workouts. Rep drop compares first and last set at the same load.</T>
          </Card>
        </Section>
      )}

      {level >= 1 && cardioWeeks.some((v) => v > 0) && (
        <Section title="Cardio minutes">
          <Card><BarChart data={cardioWeeks} labels={weekLabels} color={colors.lime} format={(v) => `${v} min`} /></Card>
        </Section>
      )}

      <Section title="Body" action={<Press onPress={() => router.push('/body-entry')}><T v="label" color={colors.cyan}>Add</T></Press>}>
        <Card>
          {weights.length ? (
            <>
              <Row style={{ justifyContent: 'space-between' }}>
                <Stat small label="Weight" value={formatWeight(weights[weights.length - 1].weightKg!, unit)} unit={unit} />
                {weights.length > 1 && <Stat small label="Change" value={`${weights[weights.length - 1].weightKg! >= weights[0].weightKg! ? '+' : ''}${formatWeight(weights[weights.length - 1].weightKg! - weights[0].weightKg!, unit)}`} unit={unit} />}
                {latest.find((b) => b.waistCm) && <Stat small label="Waist" value={latest.find((b) => b.waistCm)!.waistCm!} unit="cm" />}
              </Row>
              {weights.length > 1 && <LineChart data={weights.map((w) => toDisplay(w.weightKg!, unit))} color={colors.lime} height={90} />}
            </>
          ) : <Button small kind="secondary" icon="scalemass.fill" title="Log your weight" onPress={() => router.push('/body-entry')} />}
          {photos.length > 0 && (
            <Row gap={6}>
              {photos.map((b) => <Image key={b.id} source={b.photo!} style={{ flex: 1, aspectRatio: 0.75, borderRadius: radius.sm, maxWidth: 80 }} contentFit="cover" />)}
            </Row>
          )}
        </Card>
      </Section>

      {level >= 3 && (
        <Section title="Data quality">
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <Stat small label="Workouts" value={done.length} />
              <Stat small label="RIR rated" value={`${Math.round(effortSummary(done.flatMap((x) => x.sets)).coverage * 100)}%`} />
              <Stat small label="Weigh-ins" value={weights.length} />
            </Row>
            <T v="caption" color={colors.faint} style={{ textTransform: 'none', letterSpacing: 0 }}>Advice stays general until there are at least two sessions per exercise with effort ratings.</T>
          </Card>
        </Section>
      )}
      <View style={{ height: 1, backgroundColor: alpha(colors.cyan, 0) }} />
    </Screen>
  );
}

/** Lifts as swipeable cards: picture, estimated max, change and a small trend line. */
function LiftCarousel({ ids, selected, onSelect, done, unit }: { ids: string[]; selected?: string; onSelect: (id: string) => void; done: Parameters<typeof strengthTrend>[0]; unit: 'kg' | 'lb' }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={152} decelerationRate="fast" contentContainerStyle={{ gap: space.sm, paddingRight: space.lg }} style={{ marginHorizontal: -space.lg, paddingLeft: space.lg }}>
      {ids.map((id) => {
        const e = exercise(id);
        const t = strengthTrend(done, id);
        const last = t[t.length - 1]?.value ?? 0;
        const change = t.length > 1 ? last - t[0].value : 0;
        const on = id === selected;
        return (
          <Press key={id} onPress={() => onSelect(id)} style={{ width: 144, padding: space.sm, gap: 6, borderRadius: radius.lg, backgroundColor: on ? alpha(colors.cyan, 0.12) : colors.surface2, borderWidth: 1, borderColor: on ? alpha(colors.cyan, 0.6) : 'transparent' }}>
            {e && <ExerciseImage exercise={e} thumb style={{ width: 128, height: 72 }} />}
            <T v="footnote" numberOfLines={2} style={{ minHeight: 32 }}>{e?.name ?? id}</T>
            <Row gap={4} style={{ alignItems: 'baseline' }}>
              <T v="headline" color={on ? colors.cyan : colors.text} style={type.num}>{last ? formatWeight(last, unit) : '—'}</T>
              <T v="footnote" color={colors.faint}>{last ? unit : ''}</T>
              {t.length > 1 && <T v="footnote" color={change >= 0 ? colors.lime : colors.amber} style={type.num}>{change >= 0 ? '+' : ''}{formatWeight(change, unit)}</T>}
            </Row>
            {t.length > 1 ? <LineChart data={t.map((x) => toDisplay(x.value, unit))} height={26} color={on ? colors.cyan : colors.dim} /> : <View style={{ height: 26 }} />}
          </Press>
        );
      })}
    </ScrollView>
  );
}

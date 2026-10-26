import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, ScrollView, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import { ACTIVITY_ICON } from '../src/components/CardioPlanCard';
import { Icon } from '../src/components/Icon';
import { Button, Card, Chip, Press, Row, Screen, Section, Segmented, Stepper, T, Toggle } from '../src/components/ui';
import { CARDIO_ACTIVITIES } from '../src/domain/importer';
import { cardioKcal, formatClock, pace, phaseCue, phasePace, timeline, totalSeconds, type PhaseKind } from '../src/domain/intervals';
import { cueWords, formatPace, formatPaceRange, tracksDistance } from '../src/domain/track';
import type { IntervalPlan, PaceRange } from '../src/domain/types';
import { latestWeight, today, uid, useStore } from '../src/store';
import { alpha, colors, space } from '../src/theme';

const PRESETS: { name: string; plan: IntervalPlan }[] = [
  { name: 'Intervals 6 × 1′', plan: { activity: 'Running', warmupSeconds: 300, workSeconds: 60, recoverySeconds: 90, rounds: 6, cooldownSeconds: 300, workCue: 'Hard', recoveryCue: 'Easy jog', countdown: 5, workPace: { fast: 260, slow: 280 }, recoveryPace: { fast: 390, slow: 450 } } },
  { name: 'Tempo 20′', plan: { activity: 'Running', warmupSeconds: 600, workSeconds: 1200, recoverySeconds: 0, rounds: 1, cooldownSeconds: 300, workCue: 'Tempo', recoveryCue: '', countdown: 10, workPace: { fast: 290, slow: 310 } } },
  { name: 'Run/walk 6 × 90″', plan: { activity: 'Running', warmupSeconds: 300, workSeconds: 90, recoverySeconds: 120, rounds: 6, cooldownSeconds: 300, workCue: 'Easy', recoveryCue: 'Walk', warmupCue: 'Brisk walk', cooldownCue: 'Walk', countdown: 5, workPace: { fast: 435, slow: 495 }, recoveryPace: { fast: 600, slow: 720 } } },
  { name: 'HIIT 30/30', plan: { activity: 'HIIT', warmupSeconds: 180, workSeconds: 30, recoverySeconds: 30, rounds: 10, cooldownSeconds: 120, workCue: 'All out', recoveryCue: 'Rest', countdown: 3 } },
  { name: 'Row 4 × 2′', plan: { activity: 'Rowing', warmupSeconds: 300, workSeconds: 120, recoverySeconds: 120, rounds: 4, cooldownSeconds: 180, workCue: 'Hard', recoveryCue: 'Light pace', countdown: 5 } },
  { name: 'Zone 2 · 40′', plan: { activity: 'Cycling', warmupSeconds: 0, workSeconds: 2400, recoverySeconds: 0, rounds: 1, cooldownSeconds: 0, workCue: 'Steady', recoveryCue: '', countdown: 10 } },
];

type Source = { kind: 'planned' | 'saved'; id: string } | null;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Guided cardio: build or change a session (a planned day, a saved workout or a new one), save it
 * for later or start it; or log one already done.
 */
export default function Cardio() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const reduced = useReducedMotion();
  const s = useStore();
  const planned = s.cardio.filter((c) => !c.completed && c.plan).sort((a, b) => a.date.localeCompare(b.date));
  // Opens on the session asked for, else today's planned one, else the last one used.
  const first = planned.find((c) => c.id === id) ?? planned.find((c) => c.date === today());
  const [mode, setMode] = useState<'plan' | 'log'>('plan');
  const [source, setSource] = useState<Source>(first ? { kind: 'planned', id: first.id } : null);
  const [plan, setPlan] = useState<IntervalPlan>(first?.plan ?? s.cardioPlans[0] ?? PRESETS[0].plan);
  const [flash, setFlash] = useState(false);
  const up = (patch: Partial<IntervalPlan>) => { setFlash(false); setPlan((p) => ({ ...p, ...patch })); };
  const [log, setLog] = useState({ activity: 'Running', minutes: 30, km: 5, rpe: 6 });
  const weight = latestWeight(s);
  const history = [...s.cardio].filter((c) => c.completed).sort((a, b) => b.date.localeCompare(a.date));

  const day = source?.kind === 'planned' ? s.cardio.find((c) => c.id === source.id) : undefined;
  const saved = source?.kind === 'saved' ? s.savedCardio.find((x) => x.id === source.id) : undefined;
  const stored = day?.plan ?? saved?.plan;
  const dirty = !stored || !same(stored, plan);
  const total = totalSeconds(plan);

  const load = (next: Source, p: IntervalPlan) => { setSource(next); setPlan(p); setFlash(false); };
  const saveNew = () => {
    const keep = (name: string) => {
      const x = { id: uid(), name: name.trim() || `${plan.activity} ${formatClock(total)}`, plan };
      useStore.getState().set({ savedCardio: [x, ...useStore.getState().savedCardio] });
      load({ kind: 'saved', id: x.id }, plan);
      setFlash(true);
    };
    if (Platform.OS === 'ios') Alert.prompt('Save workout', 'Name it to find it again under Saved.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Save', onPress: (v?: string) => keep(v ?? '') }], 'plain-text', saved?.name ?? day?.name ?? '');
    else keep('');
  };
  const save = () => {
    if (day) s.saveCardio({ ...day, activity: plan.activity, plan, minutes: Math.round(total / 60) });
    else if (saved) s.set({ savedCardio: s.savedCardio.map((x) => (x.id === saved.id ? { ...x, plan } : x)) });
    else return saveNew();
    setFlash(true);
  };
  const removeSaved = (x: { id: string; name: string }) => {
    const go = () => { s.set({ savedCardio: s.savedCardio.filter((y) => y.id !== x.id) }); if (saved?.id === x.id) setSource(null); };
    if (Platform.OS === 'web') return go();
    Alert.alert(`Delete "${x.name}"?`, undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: go }]);
  };
  const start = () => {
    if (day && dirty) s.saveCardio({ ...day, activity: plan.activity, plan, minutes: Math.round(total / 60) });
    s.set({ cardioRun: { id: day?.id ?? uid(), date: today(), plan, banked: 0, resumedAt: Date.now() }, cardioPlans: [plan, ...s.cardioPlans.filter((x) => !same(x, plan))].slice(0, 6) });
    router.push('/cardio-run');
  };

  return (
    <Screen>
      {s.cardioRun && (
        <Card onPress={() => router.push('/cardio-run')} style={{ borderColor: alpha(colors.cyan, 0.5), flexDirection: 'row', alignItems: 'center' }}>
          <Icon name="figure.run" color={colors.cyan} size={22} />
          <T v="headline" style={{ flex: 1 }}>{s.cardioRun.plan.activity} in progress</T>
          <Icon name="chevron.right" size={14} color={colors.faint} />
        </Card>
      )}
      <Segmented options={[{ value: 'plan', label: 'Guided' }, { value: 'log', label: 'Log done' }]} value={mode} onChange={(v) => setMode(v as any)} />

      {mode === 'plan' ? (
        <>
          {(day || saved) && (
            <Animated.View entering={reduced ? undefined : FadeIn.duration(180)} key={source?.id}>
              <Card style={{ gap: 4, borderColor: alpha(colors.cyan, 0.35) }}>
                <T v="caption" color={colors.cyan}>{day ? `Planned · ${day.date === today() ? 'today' : day.date}` : 'Saved workout'}</T>
                <T v="title3" numberOfLines={2}>{day?.name ?? saved?.name ?? plan.activity}</T>
                <T v="footnote" color={colors.dim}>{day ? 'Changes here update this day. Save keeps them for later; Start saves them too.' : 'Save updates this workout. Long-press it under Saved to delete it.'}</T>
                {!!day?.notes && <T v="footnote" color={colors.faint} numberOfLines={3}>{day.notes}</T>}
              </Card>
            </Animated.View>
          )}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.lg }} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg }}>
            {PRESETS.map((x) => <Chip key={x.name} label={x.name} active={!source && same(x.plan, plan)} onPress={() => load(null, x.plan)} />)}
          </ScrollView>
          {s.savedCardio.length > 0 && (
            <View style={{ gap: 6 }}>
              <T v="caption" color={colors.faint}>Saved</T>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.lg }} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg }}>
                {s.savedCardio.map((x) => <Chip key={x.id} icon="bookmark.fill" label={x.name} active={saved?.id === x.id} onPress={() => load({ kind: 'saved', id: x.id }, x.plan)} onLongPress={() => removeSaved(x)} />)}
              </ScrollView>
            </View>
          )}

          <ActivityPicker value={plan.activity} onChange={(activity) => up({ activity })} />
          <Card style={{ gap: space.lg }}>
            <Row>
              <Stepper label="Warm-up" value={plan.warmupSeconds} onChange={(warmupSeconds) => up({ warmupSeconds })} step={60} max={3600} format={formatClock} clock />
              <Stepper label="Cool-down" value={plan.cooldownSeconds} onChange={(cooldownSeconds) => up({ cooldownSeconds })} step={60} max={3600} format={formatClock} clock />
            </Row>
            <Row>
              <Stepper label="Work" value={plan.workSeconds} onChange={(workSeconds) => up({ workSeconds })} step={plan.workSeconds >= 300 ? 60 : 15} min={10} max={14400} format={formatClock} clock />
              <Stepper label="Recover" value={plan.recoverySeconds} onChange={(recoverySeconds) => up({ recoverySeconds })} step={15} max={3600} format={formatClock} clock />
            </Row>
            <Row><Stepper label="Rounds" value={plan.rounds} onChange={(rounds) => up({ rounds })} min={1} max={50} big /></Row>
            <View style={{ gap: space.sm }}>
              <T v="caption" color={colors.faint}>Beeps before each change</T>
              <Row gap={space.sm}>{[0, 3, 5, 10, 15].map((n) => <Chip key={n} label={n ? `${n}s` : 'Off'} active={plan.countdown === n} onPress={() => up({ countdown: n })} />)}</Row>
            </View>
          </Card>

          <Targets plan={plan} up={up} />

          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <Icon name="speaker.wave.2.fill" size={18} color={colors.cyan} />
            <View style={{ flex: 1 }}>
              <T v="headline">Voice coach</T>
              <T v="footnote" color={colors.dim}>Says each phase, the round and rounds left{tracksDistance(plan.activity) ? ', and when you are too slow or too fast' : ''}.</T>
            </View>
            <Toggle value={s.timer.voiceCoach !== false} onChange={(voiceCoach) => s.setTimer({ voiceCoach })} />
          </Card>

          <Timeline plan={plan} />
          <Row gap={space.sm}>
            <Button kind="secondary" icon={flash && !dirty ? 'checkmark' : 'square.and.arrow.down'} title={flash && !dirty ? 'Saved' : day || saved ? 'Save changes' : 'Save'} disabled={!!stored && !dirty} onPress={save} style={{ flex: 1 }} />
            <Button icon="play.fill" title={`Start · ${formatClock(total)}`} onPress={start} disabled={!!s.cardioRun} style={{ flex: 1.4 }} />
          </Row>
          {(day || saved) && (
            <Press onPress={saveNew} haptic={false}><T v="footnote" color={colors.cyan} style={{ textAlign: 'center' }}>Save as a new workout</T></Press>
          )}
        </>
      ) : (
        <>
          <ActivityPicker value={log.activity} onChange={(activity) => setLog({ ...log, activity })} />
          <Card style={{ gap: space.lg }}>
            <Row>
              <Stepper label="Minutes" value={log.minutes} onChange={(minutes) => setLog({ ...log, minutes })} step={5} min={1} max={600} />
              <Stepper label="Km" value={log.km} onChange={(km) => setLog({ ...log, km })} step={0.5} max={300} format={(v) => v.toFixed(1)} />
            </Row>
            <Row><Stepper label="Effort (RPE)" value={log.rpe} onChange={(rpe) => setLog({ ...log, rpe })} min={1} max={10} /></Row>
            <T v="label" color={colors.dim} style={{ textAlign: 'center' }}>
              {pace(log.minutes, log.km) ?? ''}{weight ? ` · ≈ ${cardioKcal(log.activity, log.minutes, weight)} kcal (estimate)` : ''}
            </T>
          </Card>
          <Button kind="lime" icon="checkmark" title="Save" onPress={() => {
            s.saveCardio({ id: uid(), date: today(), activity: log.activity, minutes: log.minutes, distanceKm: log.km || null, rpe: log.rpe, avgHr: null, plan: null, completed: true, notes: '' });
            setMode('plan');
          }} />
        </>
      )}

      {planned.length > 0 && mode === 'plan' && (
        <Section title="Planned">
          {planned.map((c) => (
            <Card key={c.id} onPress={() => load({ kind: 'planned', id: c.id }, c.plan!)} style={{ flexDirection: 'row', alignItems: 'center', borderColor: day?.id === c.id ? alpha(colors.cyan, 0.5) : colors.hairline }}>
              <Icon name={ACTIVITY_ICON[c.activity] ?? 'figure.run'} size={16} color={colors.cyan} />
              <View style={{ flex: 1 }}>
                <T v="headline" numberOfLines={1}>{c.name ?? c.activity}</T>
                <T v="label" color={colors.dim}>{c.date === today() ? 'Today' : c.date} · {formatClock(totalSeconds(c.plan!))}{c.plan!.rounds > 1 ? ` · ${c.plan!.rounds} rounds` : ''}</T>
              </View>
              <T v="footnote" color={day?.id === c.id ? colors.cyan : colors.faint}>{day?.id === c.id ? 'Editing' : 'Open'}</T>
            </Card>
          ))}
        </Section>
      )}
      {history.length > 0 && (
        <Section title="History">
          {history.slice(0, 15).map((c) => (
            <Card key={c.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <T v="headline">{c.name ?? c.activity} · {c.minutes} min</T>
                <T v="label" color={colors.dim}>{c.date}{c.distanceKm ? ` · ${c.distanceKm} km · ${pace(c.minutes, c.distanceKm)}` : ''}{c.rpe ? ` · RPE ${c.rpe}` : ''}</T>
              </View>
              <Press onPress={() => s.deleteCardio(c.id)} hitSlop={8}><Icon name="trash" size={14} color={colors.faint} /></Press>
            </Card>
          ))}
        </Section>
      )}
    </Screen>
  );
}

function ActivityPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
      {CARDIO_ACTIVITIES.map((a) => <Chip key={a} label={a} icon={ACTIVITY_ICON[a]} active={value === a} onPress={() => onChange(a)} />)}
    </Row>
  );
}

const NAME: Record<PhaseKind, string> = { warmup: 'Warm-up', work: 'Work', recovery: 'Recover', cooldown: 'Cool-down' };
const CUE_KEY = { warmup: 'warmupCue', work: 'workCue', recovery: 'recoveryCue', cooldown: 'cooldownCue' } as const;
const PACE_KEY = { warmup: 'warmupPace', work: 'workPace', recovery: 'recoveryPace', cooldown: 'cooldownPace' } as const;
const CUES: Record<PhaseKind, string[]> = {
  warmup: ['Walk', 'Brisk walk', 'Easy jog', 'Easy'],
  work: ['Easy', 'Steady', 'Tempo', 'Hard', 'All out'],
  recovery: ['Walk', 'Easy jog', 'Light pace', 'Rest'],
  cooldown: ['Walk', 'Easy jog', 'Ease down'],
};
/** Seconds per km a new pace target starts from, per activity. */
const BASE: Record<string, number> = { Running: 360, Walking: 630, Cycling: 160 };
const MILE = 1.609344;

/**
 * What each phase aims for: an effort word and, for GPS activities, a pace window. The voice says
 * when the live pace leaves the window. Paces are kept per km and shown in the chosen unit.
 */
function Targets({ plan, up }: { plan: IntervalPlan; up: (p: Partial<IntervalPlan>) => void }) {
  const gps = tracksDistance(plan.activity);
  const kinds = (['warmup', 'work', 'recovery', 'cooldown'] as PhaseKind[]).filter((k) =>
    k === 'work' || (k === 'warmup' ? plan.warmupSeconds > 0 : k === 'cooldown' ? plan.cooldownSeconds > 0 : plan.rounds > 1 && plan.recoverySeconds > 0));
  const [picked, setPicked] = useState<PhaseKind>('work');
  const kind = kinds.includes(picked) ? picked : 'work';
  const unit = plan.paceUnit ?? 'km';
  const words = cueWords(plan[CUE_KEY[kind]] ?? '');
  const range = phasePace(plan, kind);
  const shown = (v: number) => Math.round(unit === 'mi' ? v * MILE : v);
  const perKm = (v: number) => (unit === 'mi' ? v / MILE : v);
  // A pace written in the cue becomes the phase's own value, so the cue keeps only its words.
  const setRange = (r: PaceRange | null) => up({ [PACE_KEY[kind]]: r, [CUE_KEY[kind]]: words } as Partial<IntervalPlan>);
  const setCue = (cue: string) => up({ [CUE_KEY[kind]]: cue, [PACE_KEY[kind]]: range } as Partial<IntervalPlan>);
  const turnOn = () => {
    const f = Math.round(((BASE[plan.activity] ?? 360) * (kind === 'work' ? 1 : kind === 'recovery' ? 1.25 : 1.3)) / 5) * 5;
    setRange({ fast: f, slow: f + 30 });
  };
  const cues = [...CUES[kind], ...(words && !CUES[kind].includes(words) ? [words] : [])];
  return (
    <Card style={{ gap: space.md }}>
      <T v="headline">Targets</T>
      {kinds.length > 1 && <Segmented options={kinds.map((k) => ({ value: k, label: NAME[k] }))} value={kind} onChange={setPicked} />}
      {gps && (
        <>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <T v="callout">Pace target</T>
              <T v="footnote" color={colors.dim}>{range ? formatPaceRange(range, unit) : `None for ${NAME[kind].toLowerCase()}`}</T>
            </View>
            <Toggle value={!!range} onChange={(on) => (on ? turnOn() : setRange(null))} />
          </Row>
          {range && (
            <>
              <Row>
                <Stepper label="Fastest" value={shown(range.fast)} step={5} min={120} max={1800} clock format={(v) => formatPace(v)}
                  onChange={(v) => { const fast = perKm(v); setRange({ fast, slow: Math.max(fast, range.slow) }); }} />
                <Stepper label="Slowest" value={shown(range.slow)} step={5} min={120} max={1800} clock format={(v) => formatPace(v)}
                  onChange={(v) => { const slow = perKm(v); setRange({ fast: Math.min(slow, range.fast), slow }); }} />
              </Row>
              <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
                <Chip label="per km" active={unit === 'km'} onPress={() => up({ paceUnit: 'km' })} />
                <Chip label="per mile" active={unit === 'mi'} onPress={() => up({ paceUnit: 'mi' })} />
                <Chip label="One target" active={range.fast === range.slow} onPress={() => setRange({ fast: range.fast, slow: range.fast })} />
              </Row>
              <T v="footnote" color={colors.dim}>
                The voice says "Pick it up" when you are slower than {formatPace(shown(range.slow))}, "Ease off" when faster than {formatPace(shown(range.fast))}, and "Back on pace" when you return.
              </T>
            </>
          )}
        </>
      )}
      <View style={{ gap: 6 }}>
        <T v="caption" color={colors.faint}>Effort · shown and spoken</T>
        <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
          {cues.map((e) => <Chip key={e} label={e} active={words === e} onPress={() => setCue(words === e ? '' : e)} />)}
        </Row>
        {!words && (kind === 'warmup' || kind === 'cooldown') && <T v="footnote" color={colors.faint}>Shows "{phaseCue({ ...plan, [CUE_KEY[kind]]: '' }, kind)}" when none is picked.</T>}
      </View>
    </Card>
  );
}

/** Proportional strip of the session's phases. */
function Timeline({ plan }: { plan: IntervalPlan }) {
  const phases = timeline(plan);
  const total = totalSeconds(plan) || 1;
  const color = { warmup: colors.steel, work: colors.cyan, recovery: colors.lime, cooldown: colors.steel };
  return (
    <View style={{ flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 }}>
      {phases.map((p, i) => <View key={i} style={{ flex: p.seconds / total, backgroundColor: color[p.kind], opacity: p.kind === 'warmup' || p.kind === 'cooldown' ? 0.5 : 1 }} />)}
    </View>
  );
}

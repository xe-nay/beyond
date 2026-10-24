import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';

import { Icon, type IconName } from '../src/components/Icon';
import { Button, Card, Chip, Press, Row, Screen, Section, Segmented, Stepper, T } from '../src/components/ui';
import { cardioKcal, formatClock, pace, timeline, totalSeconds } from '../src/domain/intervals';
import type { IntervalPlan } from '../src/domain/types';
import { latestWeight, today, uid, useStore } from '../src/store';
import { alpha, colors, radius, space } from '../src/theme';

const ACTIVITIES: [string, IconName][] = [['Running', 'figure.run'], ['Walking', 'figure.walk'], ['Cycling', 'bicycle'], ['Rowing', 'figure.rower'], ['Swimming', 'figure.pool.swim'], ['Elliptical', 'figure.elliptical'], ['Stairs', 'figure.stair.stepper'], ['HIIT', 'figure.highintensity.intervaltraining']];

const PRESETS: (IntervalPlan & { name: string })[] = [
  { name: 'Intervals 6 × 1′', activity: 'Running', warmupSeconds: 300, workSeconds: 60, recoverySeconds: 90, rounds: 6, cooldownSeconds: 300, workCue: '4:30 /km', recoveryCue: 'Easy jog', countdown: 5 },
  { name: 'Tempo 20′', activity: 'Running', warmupSeconds: 600, workSeconds: 1200, recoverySeconds: 0, rounds: 1, cooldownSeconds: 300, workCue: '5:00 /km', recoveryCue: '', countdown: 10 },
  { name: 'HIIT 30/30', activity: 'HIIT', warmupSeconds: 180, workSeconds: 30, recoverySeconds: 30, rounds: 10, cooldownSeconds: 120, workCue: 'All out', recoveryCue: 'Breathe', countdown: 3 },
  { name: 'Row 4 × 500 m', activity: 'Rowing', warmupSeconds: 300, workSeconds: 120, recoverySeconds: 120, rounds: 4, cooldownSeconds: 180, workCue: '1:55 /500m', recoveryCue: 'Light paddle', countdown: 5 },
  { name: 'Zone 2 · 40′', activity: 'Cycling', warmupSeconds: 0, workSeconds: 2400, recoverySeconds: 0, rounds: 1, cooldownSeconds: 0, workCue: 'Conversational', recoveryCue: '', countdown: 10 },
];

export default function Cardio() {
  const router = useRouter();
  const s = useStore();
  const [mode, setMode] = useState<'plan' | 'log'>('plan');
  const [plan, setPlan] = useState<IntervalPlan>(s.cardioPlans[0] ?? PRESETS[0]);
  const up = (patch: Partial<IntervalPlan>) => setPlan((p) => ({ ...p, ...patch }));
  const [log, setLog] = useState({ activity: 'Running', minutes: 30, km: 5, rpe: 6 });
  const weight = latestWeight(s);
  const history = [...s.cardio].filter((c) => c.completed).sort((a, b) => b.date.localeCompare(a.date));
  const planned = s.cardio.filter((c) => !c.completed && c.plan).sort((a, b) => a.date.localeCompare(b.date));

  const start = (p: IntervalPlan, id = uid()) => {
    s.set({ cardioRun: { id, date: today(), plan: p, banked: 0, resumedAt: Date.now() }, cardioPlans: [p, ...s.cardioPlans.filter((x) => JSON.stringify(x) !== JSON.stringify(p))].slice(0, 6) });
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.lg }} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg }}>
            {PRESETS.map((p) => <Chip key={p.name} label={p.name} active={JSON.stringify({ ...p, name: undefined }) === JSON.stringify({ ...plan, name: undefined })} onPress={() => { const { name, ...rest } = p; setPlan(rest); }} />)}
          </ScrollView>
          <ActivityPicker value={plan.activity} onChange={(activity) => up({ activity })} />
          <Card style={{ gap: space.lg }}>
            <Row>
              <Stepper label="Warm-up" value={plan.warmupSeconds} onChange={(warmupSeconds) => up({ warmupSeconds })} step={60} max={1800} format={formatClock} />
              <Stepper label="Cool-down" value={plan.cooldownSeconds} onChange={(cooldownSeconds) => up({ cooldownSeconds })} step={60} max={1800} format={formatClock} />
            </Row>
            <Row>
              <Stepper label="Work" value={plan.workSeconds} onChange={(workSeconds) => up({ workSeconds })} step={plan.workSeconds >= 300 ? 60 : 15} min={10} max={7200} format={formatClock} />
              <Stepper label="Recover" value={plan.recoverySeconds} onChange={(recoverySeconds) => up({ recoverySeconds })} step={15} max={1800} format={formatClock} />
            </Row>
            <Row><Stepper label="Rounds" value={plan.rounds} onChange={(rounds) => up({ rounds })} min={1} max={50} big /></Row>
            <Row>
              <Cue label="Work cue" value={plan.workCue} onChange={(workCue) => up({ workCue })} placeholder="Pace, e.g. 4:30 /km" />
              <Cue label="Recovery cue" value={plan.recoveryCue} onChange={(recoveryCue) => up({ recoveryCue })} placeholder="Easy jog" />
            </Row>
            <View style={{ gap: space.sm }}>
              <T v="caption" color={colors.faint}>Beeps before each change</T>
              <Row gap={space.sm}>{[0, 3, 5, 10, 15].map((n) => <Chip key={n} label={n ? `${n}s` : 'Off'} active={plan.countdown === n} onPress={() => up({ countdown: n })} />)}</Row>
            </View>
          </Card>
          <Timeline plan={plan} />
          <Button icon="play.fill" title={`Start · ${formatClock(totalSeconds(plan))}`} onPress={() => start(plan)} />
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

      {planned.length > 0 && (
        <Section title="Planned">
          {planned.map((c) => (
            <Card key={c.id} onPress={() => start(c.plan!, c.id)} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}><T v="headline">{c.activity}</T><T v="label" color={colors.dim}>{c.date} · {formatClock(totalSeconds(c.plan!))}</T></View>
              <Icon name="play.fill" size={14} color={colors.cyan} />
            </Card>
          ))}
        </Section>
      )}
      {history.length > 0 && (
        <Section title="History">
          {history.slice(0, 15).map((c) => (
            <Card key={c.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <T v="headline">{c.activity} · {c.minutes} min</T>
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
      {ACTIVITIES.map(([a, icon]) => <Chip key={a} label={a} icon={icon} active={value === a} onPress={() => onChange(a)} />)}
    </Row>
  );
}

function Cue({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <T v="caption" color={colors.faint}>{label}</T>
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.faint} style={{ height: 44, borderRadius: radius.sm, backgroundColor: colors.surface2, color: colors.text, paddingHorizontal: space.md, fontSize: 15 }} />
    </View>
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

import { useScreenOn } from '../src/keepAwake';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../src/components/Icon';
import { Button, Press, Ring, Row, Stepper, T } from '../src/components/ui';
import { elapsed, formatClock, pause, position, resume, skip, timeline, totalSeconds } from '../src/domain/intervals';
import { buzz, cancelEnd, play, playCountdown, prepareAudio, scheduleEnd, stopCue } from '../src/sound';
import { useStore } from '../src/store';
import { alpha, colors, space, type } from '../src/theme';

const LABEL = { warmup: 'Warm-up', work: 'Work', recovery: 'Recover', cooldown: 'Cool-down' };

export default function CardioRun() {
  useScreenOn('cardio-run');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const run = useStore((s) => s.cardioRun);
  const [, tick] = useState(0);
  const [done, setDone] = useState<null | { minutes: number }>(null);
  const [km, setKm] = useState(0);
  const [rpe, setRpe] = useState(6);
  const last = useRef<{ index: number; whole: number } | null>(null);
  const tickRef = useRef<number | null>(null);

  const phases = run ? timeline(run.plan) : [];
  const t = run ? elapsed({ banked: run.banked, resumedAt: run.resumedAt }) : 0;
  const pos = position(phases, t);
  const total = run ? totalSeconds(run.plan) : 0;

  useEffect(() => {
    prepareAudio();
    const id = setInterval(() => tick((n) => n + 1), 100);
    return () => clearInterval(id);
  }, []);

  // One countdown file per phase change (ticks + a two-tone cue, or the closing tone at the very end),
  // started N seconds before the change so music under it dips only once.
  useEffect(() => {
    if (!run || run.resumedAt === null || done) return;
    const prev = last.current;
    if (!prev || prev.index !== pos.index) {
      if (prev && !pos.phase && !prev.whole) play('end');
      last.current = { index: pos.index, whole: 0 };
    }
    const lead = run.plan.countdown;
    if (pos.phase && last.current?.whole === 0 && pos.remaining <= Math.max(lead, 0.3) + 0.05 && AppState.currentState === 'active') {
      last.current = { index: pos.index, whole: 1 };
      playCountdown(Math.min(lead, Math.round(pos.remaining)), phases[pos.index + 1] ? 'phase' : 'end');
    }
    if (pos.phase && lead > 0 && pos.remaining <= lead) {
      const w = Math.ceil(pos.remaining);
      if (tickRef.current !== w) { tickRef.current = w; buzz('tick'); }
    }
    if (!pos.phase) {
      cancelEnd();
      setDone({ minutes: Math.round(total / 60) });
    }
  });

  // Backstop for a locked phone: a notification when the current phase ends.
  useEffect(() => {
    if (!run || run.resumedAt === null || !pos.phase) return void cancelEnd();
    const next = phases[pos.index + 1];
    scheduleEnd(Date.now() + pos.remaining * 1000, next ? LABEL[next.kind] : 'Done', next?.cue || run.plan.activity);
  }, [pos.index, run?.resumedAt]);

  if (!run) return <View style={{ flex: 1, backgroundColor: colors.black }} />;
  const set = (patch: Partial<NonNullable<typeof run>>) => useStore.getState().set({ cardioRun: { ...run, ...patch } });
  const paused = run.resumedAt === null;
  const kind = pos.phase?.kind ?? 'cooldown';
  const color = kind === 'work' ? colors.cyan : kind === 'recovery' ? colors.lime : colors.steel;
  const final = pos.phase && run.plan.countdown > 0 && pos.remaining <= run.plan.countdown;

  const finish = (save: boolean) => {
    cancelEnd();
    const s = useStore.getState();
    if (save) s.saveCardio({ id: run.id, date: run.date, activity: run.plan.activity, minutes: Math.max(1, Math.round(t / 60)), distanceKm: km || null, rpe, avgHr: null, plan: run.plan, completed: true, notes: '' });
    s.set({ cardioRun: null });
    router.back();
  };

  if (done) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.black, padding: space.xl, paddingTop: insets.top + space.xxl, gap: space.xl }}>
        <Animated.View entering={reduced ? undefined : FadeIn.duration(250)} style={{ gap: space.xl }}>
          <Icon name="checkmark.circle.fill" size={54} color={colors.lime} />
          <T v="big">{run.plan.activity} done</T>
          <T v="title" color={colors.dim} style={type.num}>{formatClock(t)}</T>
          <Row><Stepper label="Distance km" value={km} onChange={setKm} step={0.1} max={300} format={(v) => v.toFixed(1)} big /></Row>
          <Row><Stepper label="Effort (RPE)" value={rpe} onChange={setRpe} min={1} max={10} /></Row>
          <Button kind="lime" icon="checkmark" title="Save" onPress={() => finish(true)} />
          <Press onPress={() => finish(false)}><T v="label" color={colors.red} style={{ textAlign: 'center' }}>Discard</T></Press>
        </Animated.View>
      </View>
    );
  }

  const next = phases[pos.index + 1];
  return (
    <View style={{ flex: 1, backgroundColor: colors.black, paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.lg, paddingHorizontal: space.xl }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Press onPress={() => router.back()} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}><Icon name="chevron.down" size={16} /></Press>
        <T v="headline">{run.plan.activity}</T>
        <T v="label" color={colors.dim} style={type.num}>{formatClock(t)} / {formatClock(total)}</T>
      </Row>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xl }}>
        <Animated.View key={pos.index} entering={reduced ? undefined : FadeIn.duration(200)} style={{ alignItems: 'center', gap: 6 }}>
          <T v="caption" color={color}>{LABEL[kind]}{pos.phase?.round ? ` · ${pos.phase.round}/${run.plan.rounds}` : ''}</T>
          <T v="title" style={{ textAlign: 'center' }}>{pos.phase?.cue || ' '}</T>
        </Animated.View>
        <Ring size={290} stroke={14} progress={1 - pos.progress} color={final ? colors.amber : color} track={alpha(color, 0.12)}>
          <T style={[type.hero, { fontSize: 80, color: final ? colors.amber : colors.text }]}>{formatClock(pos.remaining)}</T>
          {paused && <T v="caption" color={colors.dim}>Paused</T>}
        </Ring>
        <T v="label" color={colors.dim}>{next ? `Next: ${LABEL[next.kind]} ${formatClock(next.seconds)}${next.cue ? ` · ${next.cue}` : ''}` : 'Last phase'}</T>
      </View>

      <View style={{ flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', gap: 2, marginBottom: space.xl }}>
        {phases.map((p, i) => (
          <View key={i} style={{ flex: p.seconds, backgroundColor: i < pos.index ? colors.surface3 : i === pos.index ? color : alpha(p.kind === 'work' ? colors.cyan : colors.lime, 0.3) }} />
        ))}
      </View>
      <Row style={{ justifyContent: 'center' }} gap={space.xl}>
        <Press onPress={() => setDone({ minutes: Math.round(t / 60) })} style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}><Icon name="stop.fill" size={18} color={colors.red} /></Press>
        <Press onPress={() => { stopCue(); set(paused ? resume({ banked: run.banked, resumedAt: null }) : pause({ banked: run.banked, resumedAt: run.resumedAt })); }} style={{ width: 82, height: 82, borderRadius: 41, backgroundColor: colors.cyan, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={paused ? 'play.fill' : 'pause.fill'} size={28} color={colors.black} />
        </Press>
        <Press onPress={() => { stopCue(); set(skip({ banked: run.banked, resumedAt: run.resumedAt }, phases)); }} style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}><Icon name="forward.fill" size={18} /></Press>
      </Row>
    </View>
  );
}

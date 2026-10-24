import { useScreenOn } from '../src/keepAwake';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Ambient, Glass, GlassButton, HoldButton, PHASE, PhaseRings, RoundDots } from '../src/components/CardioVisuals';
import { Icon, type IconName } from '../src/components/Icon';
import { Button, Press, Row, Stepper, T } from '../src/components/ui';
import { elapsed, formatClock, pause, position, resume, skip, timeline, totalSeconds } from '../src/domain/intervals';
import { buzz, cancelEnd, play, playCountdown, prepareAudio, scheduleEnd, stopCue } from '../src/sound';
import { useStore } from '../src/store';
import { alpha, colors, space, type } from '../src/theme';

const LABEL = { warmup: 'Warm-up', work: 'Work', recovery: 'Recover', cooldown: 'Cool-down' } as const;

export default function CardioRun() {
  useScreenOn('cardio-run');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
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
  const look = PHASE[kind];
  const doneRounds = phases.slice(0, pos.index).filter((x) => x.kind === 'work').length;
  const current = pos.phase?.kind === 'work' ? pos.phase.round : pos.phase?.kind === 'recovery' ? pos.phase.round + 0.5 : 0;
  const ringSize = Math.min(width - space.xl * 2, 320);
  const togglePause = () => {
    stopCue();
    set(paused ? resume({ banked: run.banked, resumedAt: null }) : pause({ banked: run.banked, resumedAt: run.resumedAt }));
  };
  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <Ambient kind={kind} pulseKey={pos.index} />
      <View style={{ flex: 1, paddingTop: insets.top + space.sm, paddingBottom: insets.bottom + space.lg, paddingHorizontal: space.xl }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <GlassButton size={38} onPress={() => router.back()}><Icon name="chevron.down" size={15} /></GlassButton>
          <Row gap={6}>
            <Icon name={ACTIVITY_ICON[run.plan.activity] ?? 'figure.run'} size={15} color={look.a} />
            <T v="headline">{run.plan.activity}</T>
          </Row>
          <Glass round style={{ paddingHorizontal: 12, height: 38, justifyContent: 'center' }}>
            <T v="footnote" color={colors.dim} style={type.num}>{formatClock(t)}</T>
          </Glass>
        </Row>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xl }}>
          <PhaseRings
            size={ringSize} kind={kind} phaseKey={pos.index * 2 + (paused ? 1 : 0)} running={!paused}
            phaseLeft={pos.remaining} phaseSeconds={pos.phase?.seconds ?? 1} sessionLeft={Math.max(0, total - t)} sessionSeconds={total}>
            <Animated.View key={pos.index} entering={reduced ? undefined : FadeInDown.duration(320).springify().dampingRatio(0.8)} style={{ alignItems: 'center' }}>
              <T v="caption" color={look.a} style={{ letterSpacing: 1.5 }}>{look.label}{pos.phase?.round ? `  ${pos.phase.round}/${run.plan.rounds}` : ''}</T>
              <Digits value={formatClock(pos.remaining)} final={!!final} second={Math.ceil(pos.remaining)} />
              {paused && <T v="footnote" color={colors.dim}>Paused</T>}
            </Animated.View>
          </PhaseRings>

          {!!pos.phase?.cue && (
            <Glass round style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, height: 44 }}>
              <Icon name="gauge.with.dots.needle.67percent" size={16} color={look.a} />
              <T v="headline">{pos.phase.cue}</T>
            </Glass>
          )}
          <RoundDots rounds={run.plan.rounds} current={Math.floor(current)} done={doneRounds} tint={look.a} />
        </View>

        <Glass style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, marginBottom: space.lg }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(next ? PHASE[next.kind].a : colors.lime, 0.18) }}>
            <Icon name={next ? 'forward.fill' : 'checkmark'} size={14} color={next ? PHASE[next.kind].a : colors.lime} />
          </View>
          <View style={{ flex: 1 }}>
            <T v="footnote" color={colors.dim}>{next ? 'Up next' : 'Last phase'}</T>
            <T v="headline" numberOfLines={1}>{next ? `${PHASE[next.kind].label} · ${formatClock(next.seconds)}${next.cue ? ` · ${next.cue}` : ''}` : 'Finish strong'}</T>
          </View>
          <T v="footnote" color={colors.faint} style={type.num}>{formatClock(Math.max(0, total - t))} left</T>
        </Glass>

        <Row style={{ justifyContent: 'space-between', paddingHorizontal: space.lg }}>
          <HoldButton size={64} onConfirm={() => setDone({ minutes: Math.round(t / 60) })}><Icon name="stop.fill" size={18} color={colors.red} /></HoldButton>
          <GlassButton size={92} tint={look.a} onPress={togglePause}><Icon name={paused ? 'play.fill' : 'pause.fill'} size={32} color={colors.black} /></GlassButton>
          <GlassButton size={64} onPress={() => { stopCue(); set(skip({ banked: run.banked, resumedAt: run.resumedAt }, phases)); }}><Icon name="forward.fill" size={18} /></GlassButton>
        </Row>
        <T v="footnote" color={colors.faint} style={{ textAlign: 'center', marginTop: space.sm }}>Hold the stop button to end</T>
      </View>
    </View>
  );
}

const ACTIVITY_ICON: Record<string, IconName> = {
  Running: 'figure.run', Walking: 'figure.walk', Cycling: 'bicycle', Rowing: 'figure.rower', Swimming: 'figure.pool.swim',
  Elliptical: 'figure.elliptical', Stairs: 'figure.stair.stepper', HIIT: 'figure.highintensity.intervaltraining',
};

/** Big rounded digits; in the final countdown each second pops and turns amber. */
function Digits({ value, final, second }: { value: string; final: boolean; second: number }) {
  const reduced = useReducedMotion();
  const pop = useSharedValue(1);
  useEffect(() => {
    if (final && !reduced) pop.set(withSequence(withTiming(1.12, { duration: 90 }), withSpring(1, { duration: 450, dampingRatio: 0.5 })));
  }, [second, final]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() }] }));
  return (
    <Animated.Text style={[type.hero, { fontSize: 84, lineHeight: 96, color: final ? colors.amber : colors.text, transitionProperty: 'color', transitionDuration: 200 } as any, st]}>{value}</Animated.Text>
  );
}

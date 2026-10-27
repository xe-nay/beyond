// A workout as one card, planned or done. The body (front and back, side by side) shows what it works;
// the exercises run as a numbered list with every detail: for a plan its sets, reps, RIR, rest and
// warm-ups; for a finished workout each set as it was done, with its records. A finished card turns
// over (swipe it sideways) to its records. Swipe an exercise left to open it.
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { byId, exercise } from '../catalog';
import { groupByExercise, personalRecords, REGION_NAMES, sessionMinutes, setKg, volumeLoad, working, type PR } from '../domain/calc';
import { formatClock } from '../domain/intervals';
import { formatWeight, toDisplay } from '../domain/plates';
import type { Prescription, Region, Session, WorkoutSet } from '../domain/types';
import { today, useStore } from '../store';
import { innerSwipe, releaseInner } from '../swipeGuard';
import { alpha, colors, plural, radius, space, type } from '../theme';
import { BodyMap } from './BodyMap';
import { menu } from './holdMenu';
import { Icon } from './Icon';
import { describePR } from './SummaryCard';
import { SwipeOpen } from './SwipeOpen';
import { Button, Row, T } from './ui';

const KIND: Record<string, string> = { first: 'First time', weight: 'Heaviest', e1rm: 'Best max', reps: 'Most reps', volume: 'Best set' };
const settle = () => Platform.OS !== 'web' && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

/** The muscles a list of exercises works: primary first, supporting ones not already primary. */
function muscles(ids: string[]) {
  const primary = [...new Set(ids.flatMap((id) => byId[id]?.primary ?? []))] as Region[];
  const secondary = [...new Set(ids.flatMap((id) => byId[id]?.secondary ?? []))].filter((r) => !primary.includes(r as Region)) as Region[];
  return { primary, secondary };
}

/** A deep navy surface with a soft light from the top corner; lime-edged once done. */
export function Shell({ done, fill, children }: { done?: boolean; fill?: boolean; children: ReactNode }) {
  return (
    <LinearGradient
      colors={done ? ['#14261C', '#0B1220', '#070B14'] : ['#12223D', '#0B1220', '#070B14']}
      start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 1 }}
      style={[styles.shell, fill && { flex: 1 }, { borderColor: alpha(done ? colors.lime : colors.cyan, 0.28) }]}>
      {children}
    </LinearGradient>
  );
}

/** Front and back, large and side by side, with the muscles named underneath. */
function Hero({ primary, secondary }: { primary: Region[]; secondary: Region[] }) {
  const [w, setW] = useState(0);
  // Each figure is about 200 × 400 points at scale 1.
  const scale = w ? Math.min(0.66, (w - space.lg) / 420) : 0;
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ gap: space.md }}>
      <View style={styles.stage}>
        <View style={styles.glow} />
        {scale > 0 && (
          <Row gap={space.lg} style={{ justifyContent: 'center' }}>
            <View style={{ alignItems: 'center', gap: 4 }}>
              <BodyMap primary={primary} secondary={secondary} scale={scale} only="front" />
              <T v="caption" color={colors.faint}>Front</T>
            </View>
            <View style={{ alignItems: 'center', gap: 4 }}>
              <BodyMap primary={primary} secondary={secondary} scale={scale} only="back" />
              <T v="caption" color={colors.faint}>Back</T>
            </View>
          </Row>
        )}
      </View>
      {primary.length + secondary.length > 0 && (
        <Row gap={6} style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
          {primary.map((r) => <Tag key={r} label={REGION_NAMES[r]} strong />)}
          {secondary.map((r) => <Tag key={r} label={REGION_NAMES[r]} />)}
        </Row>
      )}
    </View>
  );
}

function Tag({ label, strong }: { label: string; strong?: boolean }) {
  return (
    <Row gap={5} style={[styles.tag, strong && { backgroundColor: alpha(colors.cyan, 0.14), borderColor: alpha(colors.cyan, 0.4) }]}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: strong ? colors.cyan : alpha(colors.cyan, 0.4) }} />
      <T v="footnote" color={strong ? colors.text : colors.dim}>{label}</T>
    </Row>
  );
}

/** The number in the list, in a ring. */
function Step({ n, done }: { n: number; done?: boolean }) {
  return (
    <View style={[styles.step, done && { borderColor: alpha(colors.lime, 0.6), backgroundColor: alpha(colors.lime, 0.1) }]}>
      <T v="footnote" color={done ? colors.lime : colors.cyan} style={[type.num, { fontWeight: '700' }]}>{n}</T>
    </View>
  );
}

export function Head({ label, title, sub, tint, hint }: { label: string; title: string; sub: string; tint: string; hint?: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={[styles.chip, { backgroundColor: alpha(tint, 0.14), borderColor: alpha(tint, 0.45) }]}>
          <T v="caption" color={tint}>{label}</T>
        </View>
        {hint && <T v="caption" color={colors.faint} style={{ textTransform: 'none', letterSpacing: 0 }}>{hint}</T>}
      </Row>
      <T v="title">{title}</T>
      <T v="footnote" color={colors.dim}>{sub}</T>
    </View>
  );
}

/**
 * A planned workout (today or ahead): the body it works, then each exercise with its warm-ups, sets,
 * reps, RIR and rest. Start when it is today's.
 */
export function PlanCard({ title, label, plan, unit, onStart, notes }: { title: string; label: string; plan: Prescription[]; unit: 'kg' | 'lb'; onStart?: () => void; notes?: string }) {
  const router = useRouter();
  const sets = plan.reduce((n, x) => n + x.sets, 0);
  const minutes = Math.round(plan.reduce((n, x) => n + (x.sets + (x.warmupSets ?? 0)) * (45 + x.restSeconds), 0) / 60);
  const { primary, secondary } = muscles(plan.map((x) => x.exerciseId));
  return (
    <Shell>
      <Head label={label} title={title} sub={`${plural(plan.length, 'exercise')} · ${plural(sets, 'set')} · about ${minutes} min`} tint={colors.cyan} hint="Swipe an exercise left to open it" />
      <Hero primary={primary} secondary={secondary} />
      <View style={styles.rule} />
      <View style={{ gap: space.md }}>
        {plan.map((x, i) => {
          const e = exercise(x.exerciseId);
          const reps = x.minReps === x.maxReps ? `${x.minReps}` : `${x.minReps}–${x.maxReps}`;
          return (
            <SwipeOpen key={`${x.exerciseId}-${i}`} onOpen={() => router.push({ pathname: '/exercise/[id]', params: { id: x.exerciseId, plan: JSON.stringify(x) } })}>
              <Row style={{ alignItems: 'flex-start' }}>
                <Step n={i + 1} />
                <View style={{ flex: 1, gap: 6 }}>
                  <T v="headline">{x.superset ? `${x.superset} · ` : ''}{e?.name ?? x.exerciseId}</T>
                  <Row gap={6} style={{ flexWrap: 'wrap' }}>
                    {!!x.warmupSets && <Pill text={`${x.warmupSets} warm-up`} muted />}
                    <Pill text={`${x.sets} × ${reps}`} strong />
                    <Pill text={`RIR ${x.rir}`} />
                    <Pill text={`Rest ${formatClock(x.restSeconds)}`} />
                    {x.loadKg ? <Pill text={`${formatWeight(x.loadKg, unit)} ${unit}`} /> : null}
                  </Row>
                </View>
              </Row>
            </SwipeOpen>
          );
        })}
      </View>
      {!!notes && <T v="footnote" color={colors.dim}>{notes}</T>}
      {onStart && <Button title="Start workout" icon="play.fill" onPress={onStart} />}
    </Shell>
  );
}

export function Pill({ text, strong, muted, tint }: { text: string; strong?: boolean; muted?: boolean; tint?: string }) {
  return (
    <View style={[styles.pill, strong && { backgroundColor: alpha(colors.cyan, 0.12), borderColor: alpha(colors.cyan, 0.35) }, tint && { backgroundColor: alpha(tint, 0.14), borderColor: alpha(tint, 0.45) }]}>
      <T v="footnote" color={tint ?? (muted ? colors.faint : strong ? colors.text : colors.dim)} style={type.num}>{text}</T>
    </View>
  );
}

/** One set as done: "60 × 12" (both dumbbells "2×24"), its RIR, warm-ups faint. */
function SetChip({ s, unit }: { s: WorkoutSet; unit: 'kg' | 'lb' }) {
  const w = `${s.implements === 2 ? '2×' : ''}${formatWeight(setKg(s), unit)}`;
  return <Pill text={`${s.warmup ? 'W ' : ''}${w} × ${s.reps}${s.rir !== null && !s.warmup ? ` · ${s.rir}` : ''}`} muted={s.warmup} strong={!s.warmup} />;
}

/**
 * A finished workout: the body it worked, its numbers, and each exercise set by set with its records.
 * Swipe it sideways to turn it over to the records; hold to edit.
 */
export function DoneWorkoutCard({ x }: { x: Session }) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const sessions = useStore((s) => s.sessions);
  const unit = useStore((s) => s.profile.unit);
  const records = personalRecords(sessions, x);
  const groups = groupByExercise(x.sets).filter((g) => g.sets.some((y) => y.reps > 0));
  const minutes = sessionMinutes(x);
  const { primary, secondary } = muscles(groups.map((g) => g.exerciseId));
  const open = () => menu([
    { label: 'Edit sets', go: () => router.push({ pathname: '/session/[id]', params: { id: x.id, edit: '1' } }) },
    { label: 'See the workout', go: () => router.push({ pathname: '/session/[id]', params: { id: x.id } }) },
  ]);

  // Turning over follows the finger; where it lands is decided by the swipe's direction and speed.
  const turn = useSharedValue(0);
  const start = useSharedValue(0);
  const [w, setW] = useState(340);
  const [back, setBack] = useState(false);
  const pan = Gesture.Pan()
    .activeOffsetX([-16, 16])
    .failOffsetY([-10, 10])
    .onStart(() => { innerSwipe.set(1); start.set(turn.get()); })
    .onUpdate((e) => turn.set(Math.max(-0.1, Math.min(1.1, start.get() - e.translationX / (w * 0.9)))))
    .onEnd((e) => {
      const from = start.get() > 0.5 ? 1 : 0;
      const to = Math.abs(e.translationX) > 40 || Math.abs(e.velocityX) > 500 ? 1 - from : from;
      turn.set(reduced ? withTiming(to, { duration: 1 }) : withSpring(to, { duration: 600, dampingRatio: 0.82, velocity: -e.velocityX / (w * 0.9) }));
      scheduleOnRN(setBack, to === 1);
      scheduleOnRN(settle);
    })
    .onFinalize(() => scheduleOnRN(releaseInner));
  const frontStyle = useAnimatedStyle(() => ({ transform: [{ perspective: 1600 }, { rotateY: `${interpolate(turn.get(), [0, 1], [0, 180])}deg` }], opacity: turn.get() < 0.5 ? 1 : 0 }));
  const backStyle = useAnimatedStyle(() => ({ transform: [{ perspective: 1600 }, { rotateY: `${interpolate(turn.get(), [0, 1], [-180, 0])}deg` }], opacity: turn.get() >= 0.5 ? 1 : 0 }));
  const label = x.date === today() ? 'Completed today' : 'Completed';

  return (
    <GestureDetector gesture={pan}>
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        <Animated.View style={frontStyle} pointerEvents={back ? 'none' : 'auto'}>
          <HoldArea onHold={open}>
            <Shell done>
              <Head label={`✓ ${label}`} title={x.name} sub={`${plural(groups.length, 'exercise')} · swipe for records · hold to edit`} tint={colors.lime} />
              <Hero primary={primary} secondary={secondary} />
              <Row style={styles.stats}>
                <Figure label="Time" value={minutes ? `${Math.round(minutes)}` : '—'} unit={minutes ? 'min' : ''} />
                <Figure label="Sets" value={`${working(x.sets).length}`} />
                <Figure label="Volume" value={Math.round(toDisplay(volumeLoad(x.sets), unit)).toLocaleString()} unit={unit} />
                <Figure label="Records" value={`${records.length}`} tint={records.length ? colors.lime : undefined} />
              </Row>
              <View style={{ gap: space.md }}>
                {groups.map((g, i) => {
                  const pr = records.find((r) => r.exerciseId === g.exerciseId);
                  return (
                    <SwipeOpen key={g.exerciseId} onOpen={() => router.push(`/exercise/${g.exerciseId}`)}>
                      <Row style={{ alignItems: 'flex-start' }}>
                        <Step n={i + 1} done />
                        <View style={{ flex: 1, gap: 6 }}>
                          <Row gap={8} style={{ alignItems: 'flex-start' }}>
                            <T v="headline" style={{ flex: 1 }}>{exercise(g.exerciseId)?.name ?? g.exerciseId}</T>
                            {pr && <Pill text={pr.kind === 'first' ? 'First' : 'PR'} tint={colors.lime} />}
                          </Row>
                          <Row gap={6} style={{ flexWrap: 'wrap' }}>
                            {g.sets.map((s) => <SetChip key={s.id} s={s} unit={unit} />)}
                          </Row>
                        </View>
                      </Row>
                    </SwipeOpen>
                  );
                })}
              </View>
              <T v="caption" color={colors.faint} style={{ textTransform: 'none', letterSpacing: 0 }}>Weight × reps · RIR after the dot · W = warm-up</T>
            </Shell>
          </HoldArea>
        </Animated.View>

        <Animated.View style={[StyleSheet.absoluteFill, backStyle]} pointerEvents={back ? 'auto' : 'none'}>
          <HoldArea onHold={open} fill>
            <Shell done fill>
              <Head label="Records" title={x.name} sub={records.length ? `${plural(records.length, 'record')} · swipe back` : 'Swipe back'} tint={colors.lime} />
              <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: space.md }} showsVerticalScrollIndicator={false}>
                {records.length ? records.map((r) => <RecordRow key={r.exerciseId} r={r} unit={unit} />) : (
                  <T v="label" color={colors.dim}>No new records this time. Consistency builds them.</T>
                )}
              </ScrollView>
            </Shell>
          </HoldArea>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

function RecordRow({ r, unit }: { r: PR; unit: 'kg' | 'lb' }) {
  return (
    <Row style={{ alignItems: 'flex-start' }}>
      <View style={[styles.step, { borderColor: alpha(colors.lime, 0.6), backgroundColor: alpha(colors.lime, 0.12) }]}>
        <Icon name="trophy.fill" size={12} color={colors.lime} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T v="headline">{exercise(r.exerciseId)?.name ?? r.exerciseId}</T>
        <T v="footnote" color={colors.dim}>{KIND[r.kind]}{r.previous !== null ? ` · before ${formatWeight(r.previous, unit)} ${unit}` : ''}</T>
      </View>
      <T v="headline" color={colors.lime} style={type.num}>{describePR(r, unit)}</T>
    </Row>
  );
}

export function Figure({ label, value, unit, tint }: { label: string; value: string; unit?: string; tint?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Row gap={3} style={{ alignItems: 'baseline' }}>
        <T v="title3" color={tint ?? colors.text} style={type.num}>{value}</T>
        {!!unit && <T v="footnote" color={colors.dim}>{unit}</T>}
      </Row>
      <T v="caption" color={colors.faint}>{label}</T>
    </View>
  );
}

/** A hold anywhere on the card opens its menu. */
function HoldArea({ onHold, fill, children }: { onHold: () => void; fill?: boolean; children: ReactNode }) {
  const hold = Gesture.LongPress().minDuration(450).onStart(() => scheduleOnRN(onHold));
  return (
    <GestureDetector gesture={hold}>
      <View style={fill ? { flex: 1 } : undefined}>{children}</View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  shell: { borderRadius: radius.xl, borderWidth: 1, padding: space.lg, gap: space.lg, overflow: 'hidden' },
  stage: { borderRadius: radius.lg, paddingVertical: space.md, backgroundColor: alpha('#0F1A2E', 0.6), overflow: 'hidden' },
  glow: { position: 'absolute', alignSelf: 'center', top: '18%', width: 240, height: 240, borderRadius: 120, backgroundColor: alpha(colors.cyan, 0.07) },
  tag: { paddingHorizontal: 10, height: 26, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline, backgroundColor: colors.surface2 },
  chip: { paddingHorizontal: 10, height: 24, borderRadius: 12, borderWidth: 1, justifyContent: 'center' },
  step: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: alpha(colors.cyan, 0.5), backgroundColor: alpha(colors.cyan, 0.08), alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  pill: { paddingHorizontal: 9, height: 26, borderRadius: 8, justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline, backgroundColor: alpha('#FFFFFF', 0.04) },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline },
  stats: { paddingVertical: space.md, borderRadius: radius.md, backgroundColor: alpha('#FFFFFF', 0.035) },
});

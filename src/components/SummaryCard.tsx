// The end-of-workout card. Front: exercises with set counts, PRs and total weight. Swipe (or tap)
// and it turns over like a real card to show the muscles trained and the PRs.
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { byId, exercise } from '../catalog';
import { groupByExercise, REGION_NAMES, volumeLoad, working, type PR, type PRKind } from '../domain/calc';
import { formatClock } from '../domain/intervals';
import { formatWeight, toDisplay } from '../domain/plates';
import type { Region, Session, Unit } from '../domain/types';
import { alpha, colors, plural, radius, space, type } from '../theme';
import { BodyMap } from './BodyMap';
import { Icon } from './Icon';
import { Row, T } from './ui';

export type { PR };

const KIND: Record<PRKind, string> = { first: 'First', weight: 'Heaviest', e1rm: 'Best max', reps: 'Most reps', volume: 'Best set' };
/** What a record says, in the units the user reads. */
export function describePR(p: PR, unit: Unit) {
  const w = (kg: number) => `${formatWeight(kg, unit)} ${unit}`;
  if (p.kind === 'reps') return `${p.reps} reps · ${w(p.loadKg)}`;
  if (p.kind === 'e1rm') return `≈${w(p.value)} max`;
  if (p.kind === 'volume') return `${w(p.loadKg)} × ${p.reps}`;
  return `${w(p.loadKg)} × ${p.reps}`;
}

const settle = () => Platform.OS !== 'web' && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

export function SummaryCard({ session, prs, unit, width }: { session: Session; prs: PR[]; unit: Unit; width: number }) {
  const reduced = useReducedMotion();
  const turn = useSharedValue(0); // 0 = front, 1 = back
  const start = useSharedValue(0);
  const height = width * 1.38;

  const flipTo = (to: number, velocity = 0) => {
    'worklet';
    turn.set(reduced ? withTiming(to, { duration: 1 }) : withSpring(to, { duration: 650, dampingRatio: 0.78, velocity }));
  };
  // The card follows the finger; past halfway, or with a flick, it turns over.
  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .onBegin(() => start.set(turn.get()))
    .onUpdate((e) => turn.set(Math.max(-0.15, Math.min(1.15, start.get() - e.translationX / (width * 0.9)))))
    .onEnd((e) => {
      // Any clear swipe turns the card to its other face; a small drag falls back.
      const from = start.get() > 0.5 ? 1 : 0;
      const to = Math.abs(e.translationX) > 40 || Math.abs(e.velocityX) > 500 ? 1 - from : from;
      flipTo(to, Math.min(4, Math.abs(e.velocityX) / (width * 0.9)) * (to > from ? 1 : -1));
      scheduleOnRN(settle);
    });
  const tapG = Gesture.Tap().onEnd(() => {
    flipTo(turn.get() > 0.5 ? 0 : 1);
    scheduleOnRN(settle);
  });
  const gesture = Gesture.Exclusive(pan, tapG);

  const front = useAnimatedStyle(() => ({
    transform: [{ perspective: 1400 }, { rotateY: `${interpolate(turn.get(), [0, 1], [0, 180])}deg` }, { scale: interpolate(Math.abs(turn.get() - 0.5), [0, 0.5], [0.94, 1]) }],
  }));
  const back = useAnimatedStyle(() => ({
    transform: [{ perspective: 1400 }, { rotateY: `${interpolate(turn.get(), [0, 1], [180, 360])}deg` }, { scale: interpolate(Math.abs(turn.get() - 0.5), [0, 0.5], [0.94, 1]) }],
  }));

  const groups = groupByExercise(working(session.sets));
  const total = toDisplay(volumeLoad(session.sets), unit);
  const minutes = session.startedAt ? (Date.parse(session.finishedAt ?? new Date().toISOString()) - Date.parse(session.startedAt)) / 1000 : 0;
  const prIds = new Set(prs.map((p) => p.exerciseId));
  const primary = [...new Set(groups.flatMap((g) => byId[g.exerciseId]?.primary ?? []))] as Region[];
  const secondary = [...new Set(groups.flatMap((g) => byId[g.exerciseId]?.secondary ?? []))].filter((r) => !primary.includes(r)) as Region[];

  const face = (children: ReactNode) => (
    <LinearGradient colors={['#12223D', '#070D1A', '#03060D']} start={{ x: 0, y: 0 }} end={{ x: 0.8, y: 1 }} style={[styles.face, { width, height }]}>
      <View style={styles.glow} />
      {children}
    </LinearGradient>
  );

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ width, height }}>
        <Animated.View style={[styles.side, front]}>
          {face(
            <>
              <Row style={{ justifyContent: 'space-between' }}>
                <View>
                  <T v="caption" color={colors.cyan}>{new Date(`${session.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}</T>
                  <T v="title" style={{ fontSize: 26 }}>{session.name}</T>
                </View>
                <Mark />
              </Row>
              <View style={{ flex: 1, gap: 10, marginTop: space.lg }}>
                {groups.slice(0, 9).map((g) => (
                  <Row key={g.exerciseId} gap={space.sm}>
                    <T v="body" numberOfLines={1} style={{ flex: 1 }} color={colors.text}>{exercise(g.exerciseId)?.name ?? g.exerciseId}</T>
                    {prIds.has(g.exerciseId) && <View style={styles.pr}><T style={{ fontSize: 10, fontWeight: '800' }} color={colors.black}>PR</T></View>}
                    <T v="label" color={colors.dim} style={[type.num, { width: 52, textAlign: 'right' }]}>{g.sets.length} {g.sets.length === 1 ? 'set' : 'sets'}</T>
                  </Row>
                ))}
                {groups.length > 9 && <T v="label" color={colors.faint}>+{groups.length - 9} more</T>}
              </View>
              <View style={styles.rule} />
              <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <View>
                  <T v="caption" color={colors.faint}>Total weight</T>
                  <Row gap={4} style={{ alignItems: 'baseline' }}>
                    <T style={[type.big, { fontSize: 40 }]}>{Math.round(total).toLocaleString()}</T>
                    <T v="headline" color={colors.dim}>{unit}</T>
                  </Row>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 2 }}>
                  <T v="label" color={colors.dim} style={type.num}>{plural(working(session.sets).length, 'set')} · {formatClock(minutes)}</T>
                  <Row gap={4}><Icon name="trophy.fill" size={13} color={prs.length ? colors.lime : colors.faint} /><T v="headline" color={prs.length ? colors.lime : colors.faint}>{prs.length} PR{prs.length === 1 ? '' : 's'}</T></Row>
                </View>
              </Row>
            </>,
          )}
        </Animated.View>

        <Animated.View style={[styles.side, back]}>
          {face(
            <>
              <Row style={{ justifyContent: 'space-between' }}>
                <T v="caption" color={colors.cyan}>Muscles trained</T>
                <Mark />
              </Row>
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <BodyMap primary={primary} secondary={secondary} showBoth scale={width / 560} toggle={false} />
              </View>
              <T v="label" color={colors.dim} style={{ textAlign: 'center', marginBottom: space.md }} numberOfLines={2}>{primary.map((r) => REGION_NAMES[r]).join(' · ')}</T>
              <View style={styles.rule} />
              {prs.length ? (
                prs.slice(0, 4).map((p) => (
                  <Row key={p.exerciseId} style={{ paddingVertical: 3 }}>
                    <Icon name="trophy.fill" size={13} color={colors.lime} />
                    <View style={{ flex: 1 }}>
                      <T v="body" numberOfLines={1}>{exercise(p.exerciseId)?.name}</T>
                      <T v="footnote" color={colors.faint}>{KIND[p.kind]}</T>
                    </View>
                    <T v="headline" color={colors.lime} style={type.num}>{describePR(p, unit)}</T>
                  </Row>
                ))
              ) : (
                <T v="label" color={colors.faint} style={{ textAlign: 'center' }}>No new records this time. Consistency builds them.</T>
              )}
            </>,
          )}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

function Mark() {
  return (
    <View style={{ width: 26, height: 26, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 3, borderColor: colors.cyan, borderTopColor: 'transparent', transform: [{ rotate: '45deg' }] }} />
      <View style={{ position: 'absolute', top: 0, right: 0, width: 7, height: 7, borderRadius: 4, backgroundColor: colors.lime }} />
    </View>
  );
}

const styles = StyleSheet.create({
  side: { position: 'absolute', top: 0, left: 0, backfaceVisibility: 'hidden' },
  face: { borderRadius: radius.xl, padding: space.xl, borderWidth: 1, borderColor: alpha(colors.cyan, 0.22), overflow: 'hidden' },
  glow: { position: 'absolute', top: -170, right: -130, width: 300, height: 300, borderRadius: 150, backgroundColor: alpha(colors.cyan, 0.045) },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.hairlineStrong, marginVertical: space.md },
  pr: { paddingHorizontal: 6, height: 18, borderRadius: 9, backgroundColor: colors.lime, justifyContent: 'center' },
});

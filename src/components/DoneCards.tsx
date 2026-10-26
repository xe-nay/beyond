import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActionSheetIOS, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { byId, exercise } from '../catalog';
import { groupByExercise, personalRecords, REGION_NAMES, sessionMinutes, totalLoad, volumeLoad, working } from '../domain/calc';
import { cardioKcal, formatClock, pace } from '../domain/intervals';
import { formatWeight, toDisplay } from '../domain/plates';
import type { CardioSession, Region, Session } from '../domain/types';
import { latestWeight, today, useStore } from '../store';
import { innerSwipe } from '../swipeGuard';
import { alpha, colors, space, type } from '../theme';
import { ACTIVITY_ICON } from './CardioPlanCard';
import { BodyMap } from './BodyMap';
import { Icon, type IconName } from './Icon';
import { describePR } from './SummaryCard';
import { SwipeOpen } from './SwipeOpen';
import { Card, Row, Stat, T } from './ui';

/** Holding a finished card: a short menu, or straight to the first choice off iOS. */
function menu(options: { label: string; go: () => void }[]) {
  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  if (Platform.OS !== 'ios' || options.length === 1) return options[0].go();
  ActionSheetIOS.showActionSheetWithOptions({ options: [...options.map((o) => o.label), 'Cancel'], cancelButtonIndex: options.length }, (i) => options[i]?.go());
}

function Header({ icon, title, date, hint = 'Hold to edit' }: { icon: IconName; title: string; date: string; hint?: string }) {
  return (
    <Row>
      <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(colors.lime, 0.16) }}>
        <Icon name={icon} size={18} color={colors.lime} />
      </View>
      <View style={{ flex: 1 }}>
        <T v="caption" color={colors.lime}>{date === today() ? 'Completed today' : 'Completed'}</T>
        <T v="title3" numberOfLines={2}>{title}</T>
      </View>
      <T v="caption" color={colors.faint} style={{ textTransform: 'none', letterSpacing: 0, textAlign: 'right' }}>{hint}</T>
    </Row>
  );
}

/** Where Start would be: the mark that it is done. */
function Done() {
  return (
    <Row gap={6} style={{ justifyContent: 'center', height: 44, borderRadius: 22, backgroundColor: alpha(colors.lime, 0.14) }}>
      <Icon name="checkmark.circle.fill" size={16} color={colors.lime} />
      <T v="headline" color={colors.lime}>Completed</T>
    </Row>
  );
}

const settle = () => Platform.OS !== 'web' && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
const KIND: Record<string, string> = { first: 'First time', weight: 'Heaviest', e1rm: 'Best max', reps: 'Most reps', volume: 'Best set' };

/**
 * A finished workout as the planned card it was, now completed: its stats, each exercise with its best
 * set and record, and the muscles it worked. Swipe it sideways to turn it over to the records; swipe an
 * exercise left to open it; hold to edit.
 */
export function DoneWorkoutCard({ x }: { x: Session }) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const sessions = useStore((s) => s.sessions);
  const unit = useStore((s) => s.profile.unit);
  const records = personalRecords(sessions, x);
  const groups = groupByExercise(working(x.sets)).filter((g) => g.sets.some((y) => y.reps > 0));
  const minutes = sessionMinutes(x);
  const primary = [...new Set(groups.flatMap((g) => byId[g.exerciseId]?.primary ?? []))] as Region[];
  const secondary = [...new Set(groups.flatMap((g) => byId[g.exerciseId]?.secondary ?? []))].filter((r) => !primary.includes(r as Region)) as Region[];
  const open = () => menu([
    { label: 'Edit sets', go: () => router.push({ pathname: '/session/[id]', params: { id: x.id, edit: '1' } }) },
    { label: 'See the workout', go: () => router.push({ pathname: '/session/[id]', params: { id: x.id } }) },
  ]);

  // Turning over: the card follows the finger, then settles on a face.
  const turn = useSharedValue(0);
  const start = useSharedValue(0);
  const [w, setW] = useState(320);
  const [back, setBack] = useState(false);
  const pan = Gesture.Pan()
    .activeOffsetX([-16, 16])
    .failOffsetY([-10, 10])
    .onStart(() => { innerSwipe.set(1); start.set(turn.get()); })
    .onUpdate((e) => turn.set(Math.max(-0.1, Math.min(1.1, start.get() - e.translationX / (w * 0.9)))))
    .onEnd((e) => {
      const from = start.get() > 0.5 ? 1 : 0;
      const to = Math.abs(e.translationX) > 40 || Math.abs(e.velocityX) > 500 ? 1 - from : from;
      turn.set(reduced ? withTiming(to, { duration: 1 }) : withSpring(to, { duration: 650, dampingRatio: 0.8 }));
      scheduleOnRN(setBack, to === 1);
      scheduleOnRN(settle);
    })
    .onFinalize(() => innerSwipe.set(0));
  const frontStyle = useAnimatedStyle(() => ({ transform: [{ perspective: 1400 }, { rotateY: `${interpolate(turn.get(), [0, 1], [0, 180])}deg` }], opacity: turn.get() < 0.5 ? 1 : 0 }));
  const backStyle = useAnimatedStyle(() => ({ transform: [{ perspective: 1400 }, { rotateY: `${interpolate(turn.get(), [0, 1], [-180, 0])}deg` }], opacity: turn.get() >= 0.5 ? 1 : 0 }));

  return (
    <GestureDetector gesture={pan}>
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        <Animated.View style={frontStyle} pointerEvents={back ? 'none' : 'auto'}>
          <Card onLongPress={open} style={{ borderColor: alpha(colors.lime, 0.35) }}>
            <Header icon="dumbbell.fill" title={x.name} date={x.date} hint={'Swipe for records\nHold to edit'} />
            <Row style={{ justifyContent: 'space-between' }}>
              <Stat small label="Time" value={minutes ? Math.round(minutes) : '—'} unit={minutes ? 'min' : undefined} />
              <Stat small label="Sets" value={working(x.sets).length} />
              <Stat small label="Volume" value={Math.round(toDisplay(volumeLoad(x.sets), unit)).toLocaleString()} unit={unit} />
              <Stat small label="Records" value={records.length} color={records.length ? colors.lime : undefined} />
            </Row>
            <Row style={{ alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: 6 }}>
                {groups.slice(0, 8).map((g) => {
                  const top = g.sets.reduce((a, b) => (totalLoad(b) > totalLoad(a) || (totalLoad(b) === totalLoad(a) && b.reps > a.reps) ? b : a));
                  const pr = records.find((r) => r.exerciseId === g.exerciseId);
                  return (
                    <SwipeOpen key={g.exerciseId} onOpen={() => router.push(`/exercise/${g.exerciseId}`)}>
                      <View style={{ paddingVertical: 2 }}>
                        <Row gap={6}>
                          <T v="callout" numberOfLines={1} style={{ flexShrink: 1 }}>{exercise(g.exerciseId)?.name ?? g.exerciseId}</T>
                          {pr && (
                            <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, backgroundColor: alpha(colors.lime, 0.16) }}>
                              <T v="caption" color={colors.lime}>{pr.kind === 'first' ? 'First' : 'PR'}</T>
                            </View>
                          )}
                        </Row>
                        <T v="footnote" color={colors.dim} style={type.num}>
                          {g.sets.length} {g.sets.length === 1 ? 'set' : 'sets'} · best {top.implements === 2 ? '2×' : ''}{formatWeight(top.loadKg, unit)} {unit} × {top.reps}{top.rir !== null ? ` · RIR ${top.rir}` : ''}
                        </T>
                      </View>
                    </SwipeOpen>
                  );
                })}
                {groups.length > 8 && <T v="footnote" color={colors.faint}>+{groups.length - 8} more</T>}
              </View>
              <View style={{ marginRight: -space.md, marginTop: -space.sm }} pointerEvents="none">
                <BodyMap primary={primary} secondary={secondary} scale={0.42} toggle={false} />
              </View>
            </Row>
            <Done />
          </Card>
        </Animated.View>

        <Animated.View style={[StyleSheet.absoluteFill, backStyle]} pointerEvents={back ? 'auto' : 'none'}>
          <Card onLongPress={open} style={{ flex: 1, borderColor: alpha(colors.lime, 0.35) }}>
            <Header icon="trophy.fill" title="Records" date={x.date} hint="Swipe back" />
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: space.sm }} showsVerticalScrollIndicator={false}>
              {records.length ? records.map((r) => (
                <Row key={r.exerciseId} style={{ alignItems: 'flex-start' }}>
                  <Icon name="trophy.fill" size={14} color={colors.lime} />
                  <View style={{ flex: 1 }}>
                    <T v="callout" numberOfLines={1}>{exercise(r.exerciseId)?.name ?? r.exerciseId}</T>
                    <T v="footnote" color={colors.faint}>{KIND[r.kind]}{r.previous !== null ? ` · before ${formatWeight(r.previous, unit)} ${unit}` : ''}</T>
                  </View>
                  <T v="headline" color={colors.lime} style={type.num}>{describePR(r, unit)}</T>
                </Row>
              )) : <T v="label" color={colors.dim}>No new records this time. Consistency builds them.</T>}
              <T v="footnote" color={colors.dim}>Worked: {primary.map((r) => REGION_NAMES[r]).join(' · ') || '—'}</T>
            </ScrollView>
            <Done />
          </Card>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

/** A cardio session finished today: time, distance, pace, energy, effort. */
export function DoneCardioCard({ c }: { c: CardioSession }) {
  const router = useRouter();
  const weight = useStore(latestWeight);
  const kcal = cardioKcal(c.activity, c.minutes, weight);
  const p = pace(c.minutes, c.distanceKm);
  const open = () => menu([
    { label: 'Edit time, distance or effort', go: () => router.push({ pathname: '/cardio-edit', params: { id: c.id } }) },
  ]);
  return (
    <Card onLongPress={open} style={{ borderColor: alpha(colors.lime, 0.35) }}>
      <Header icon={ACTIVITY_ICON[c.activity] ?? 'figure.run'} title={c.name ?? c.activity} date={c.date} />
      <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap', rowGap: space.md }}>
        <Stat small label="Time" value={c.minutes} unit="min" />
        {c.distanceKm ? <Stat small label="Distance" value={c.distanceKm.toFixed(2)} unit="km" /> : null}
        {p ? <Stat small label="Pace" value={p.replace(' /km', '')} unit="/km" /> : null}
        {kcal ? <Stat small label="Energy" value={kcal} unit="kcal" /> : null}
        {c.rpe ? <Stat small label="Effort" value={`${c.rpe}/10`} /> : null}
      </Row>
      {c.plan && c.plan.rounds > 1 && (
        <T v="footnote" color={colors.dim}>{c.plan.rounds} × {formatClock(c.plan.workSeconds)} work{c.plan.recoverySeconds ? ` / ${formatClock(c.plan.recoverySeconds)} recovery` : ''}</T>
      )}
      <Done />
    </Card>
  );
}

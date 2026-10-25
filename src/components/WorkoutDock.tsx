// The live session, docked above the tab bar on every tab until it is finished: the exercise and set
// you are on with the session clock, the rest countdown while resting, or the cardio phase and its
// time left. Tapping it goes back into the session.
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, LinearTransition, useReducedMotion } from 'react-native-reanimated';

import { exercise } from '../catalog';
import { working } from '../domain/calc';
import { elapsed, formatClock, position, timeline } from '../domain/intervals';
import { useStore } from '../store';
import { alpha, colors, radius, space, type } from '../theme';
import { PHASE } from './CardioVisuals';
import { Icon } from './Icon';
import { Press, Ring, T } from './ui';

/** The exercise to do next: the first one in the plan with sets still to go. */
export function currentExercise(session: { plan: { exerciseId: string; sets: number }[]; sets: { exerciseId: string; warmup: boolean }[] }) {
  for (const p of session.plan) {
    const done = working(session.sets as any).filter((x) => x.exerciseId === p.exerciseId).length;
    if (done < p.sets) return { exerciseId: p.exerciseId, set: done + 1, of: p.sets };
  }
  const last = session.sets[session.sets.length - 1];
  return last ? { exerciseId: last.exerciseId, set: 0, of: 0 } : null;
}

export function useLiveSession() {
  const session = useStore((s) => s.sessions.find((x) => x.id === s.activeSession && !x.finishedAt) ?? null);
  const run = useStore((s) => s.cardioRun);
  const rest = useStore((s) => s.rest);
  return { session, run, rest, active: !!session || !!run };
}

export function WorkoutDock() {
  const router = useRouter();
  const reduced = useReducedMotion();
  const { session, run, rest, active } = useLiveSession();
  const [, tick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [active]);
  if (!active) return null;

  let body: React.ReactNode;
  if (run) {
    const phases = timeline(run.plan);
    const t = elapsed({ banked: run.banked, resumedAt: run.resumedAt });
    const pos = position(phases, t);
    const look = PHASE[pos.phase?.kind ?? 'cooldown'];
    body = (
      <Press onPress={() => router.push('/cardio-run')} haptic={false} style={styles.row}>
        <Ring size={40} stroke={4} progress={pos.phase ? pos.remaining / pos.phase.seconds : 0} color={look.a}>
          <Icon name="figure.run" size={14} color={look.a} />
        </Ring>
        <View style={{ flex: 1 }}>
          <T v="footnote" color={pos.phase ? look.a : colors.lime}>{!pos.phase ? 'Finished · tap to save' : run.resumedAt === null ? 'Paused' : look.label}{pos.phase?.round ? ` ${pos.phase.round}/${run.plan.rounds}` : ''}</T>
          <T v="headline" numberOfLines={1}>{run.plan.activity}{pos.phase?.cue ? ` · ${pos.phase.cue}` : ''}</T>
        </View>
        {pos.phase ? <T v="title3" style={type.num}>{formatClock(pos.remaining)}</T> : <Icon name="chevron.right" size={14} color={colors.faint} />}
      </Press>
    );
  } else if (session) {
    const resting = rest.endsAt !== null || rest.paused !== null;
    const now = currentExercise(session);
    const name = now ? exercise(now.exerciseId)?.name ?? '' : session.name;
    if (resting) {
      const remaining = rest.endsAt ? Math.max(0, (rest.endsAt - Date.now()) / 1000) : (rest.paused ?? 0) / 1000;
      body = (
        <View style={styles.row}>
          <Press onPress={() => router.push('/workout')} haptic={false} style={[styles.row, { flex: 1, padding: 0 }]}>
            <Ring size={40} stroke={4} progress={rest.total ? remaining / rest.total : 0} color={colors.cyan}>
              <Icon name="timer" size={14} color={colors.cyan} />
            </Ring>
            <View style={{ flex: 1 }}>
              <T v="footnote" color={colors.cyan}>{rest.paused !== null ? 'Rest paused' : 'Rest'}{now?.of ? ` · next set ${now.set}/${now.of}` : ''}</T>
              <T v="headline" numberOfLines={1}>{name}</T>
            </View>
            <T v="title3" color={colors.cyan} style={type.num}>{formatClock(remaining)}</T>
          </Press>
          <Press onPress={() => useStore.getState().stopRest()} style={styles.skip} hitSlop={6}>
            <Icon name="forward.fill" size={13} color={colors.cyan} />
          </Press>
        </View>
      );
    } else {
      const since = session.startedAt ? (Date.now() - Date.parse(session.startedAt)) / 1000 : 0;
      body = (
        <Press onPress={() => router.push('/workout')} haptic={false} style={styles.row}>
          <View style={styles.icon}><Icon name="dumbbell.fill" size={15} color={colors.black} /></View>
          <View style={{ flex: 1 }}>
            <T v="footnote" color={colors.lime}>{now?.of ? `Set ${now.set} of ${now.of}` : 'In progress'}</T>
            <T v="headline" numberOfLines={1}>{name}</T>
          </View>
          <T v="title3" style={type.num}>{formatClock(since)}</T>
        </Press>
      );
    }
  }

  return (
    <Animated.View
      entering={reduced ? undefined : FadeInDown.duration(240)}
      exiting={reduced ? undefined : FadeOutDown.duration(160)}
      layout={reduced ? undefined : LinearTransition.duration(200)}
      style={styles.dock}>
      {body}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dock: { borderRadius: radius.xl, backgroundColor: 'rgba(30, 34, 42, 0.94)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.16)', marginBottom: space.sm, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: 10, paddingHorizontal: space.md },
  icon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  skip: { width: 36, height: 36, borderRadius: 18, backgroundColor: alpha(colors.cyan, 0.16), alignItems: 'center', justifyContent: 'center', marginRight: space.md },
});

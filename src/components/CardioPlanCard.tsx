import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, LinearTransition, useReducedMotion } from 'react-native-reanimated';

import { cueWords, formatPaceRange, tracksDistance } from '../domain/track';
import { formatClock, plannedKm, timeline, totalSeconds, type PhaseKind } from '../domain/intervals';
import type { CardioSession, PaceRange } from '../domain/types';
import { today, useStore } from '../store';
import { alpha, colors, space, type } from '../theme';
import { PHASE } from './CardioVisuals';
import { Icon, type IconName } from './Icon';
import { Button, Card, Press, Row, T } from './ui';

export const ACTIVITY_ICON: Record<string, IconName> = {
  Running: 'figure.run', Walking: 'figure.walk', Cycling: 'bicycle', Rowing: 'figure.rower', Swimming: 'figure.pool.swim',
  Elliptical: 'figure.elliptical', Stairs: 'figure.stair.stepper', HIIT: 'figure.highintensity.intervaltraining',
};

const NAME: Record<PhaseKind, string> = { warmup: 'Warm-up', work: 'Work', recovery: 'Recover', cooldown: 'Cool-down' };

/**
 * A planned cardio session in full: its phases drawn to scale, each with its time, cue and pace,
 * every step on request, the notes, and Edit / Start.
 */
export function CardioPlanCard({ c, canStart }: { c: CardioSession; canStart: boolean }) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const voice = useStore((s) => s.timer.voiceCoach !== false);
  const [steps, setSteps] = useState(false);
  const [more, setMore] = useState(false);
  const p = c.plan!;
  const unit = p.paceUnit ?? 'km';
  const phases = timeline(p);
  const total = totalSeconds(p);
  const km = tracksDistance(c.activity) ? plannedKm(phases) : null;
  const first = (k: PhaseKind) => phases.find((x) => x.kind === k);
  const rows = (['warmup', 'work', 'recovery', 'cooldown'] as PhaseKind[]).flatMap((k) => {
    const x = first(k);
    if (!x) return [];
    const n = phases.filter((y) => y.kind === k).length;
    return [{ kind: k, label: n > 1 ? `${NAME[k]} × ${n}` : NAME[k], time: formatClock(x.seconds), cue: cueWords(x.cue), pace: x.pace }];
  });
  const start = () => {
    useStore.getState().set({ cardioRun: { id: c.id, date: today(), plan: p, banked: 0, resumedAt: Date.now() } });
    router.push('/cardio-run');
  };

  return (
    <Card>
      <Row>
        <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(colors.cyan, 0.14) }}>
          <Icon name={ACTIVITY_ICON[c.activity] ?? 'figure.run'} size={18} color={colors.cyan} />
        </View>
        <View style={{ flex: 1 }}>
          <T v="caption" color={colors.faint}>Planned cardio · {c.activity}</T>
          <T v="title3" numberOfLines={2}>{c.name ?? c.activity}</T>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <T v="title3" style={type.num}>{formatClock(total)}</T>
          {km !== null && <T v="footnote" color={colors.dim} style={type.num}>≈ {(unit === 'mi' ? km / 1.609344 : km).toFixed(1)} {unit}</T>}
        </View>
      </Row>

      {/* The session to scale: each phase's share of the total time, in its colour */}
      <View style={{ flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', gap: 2 }}>
        {phases.map((x, i) => <View key={i} style={{ flex: x.seconds, backgroundColor: PHASE[x.kind].a, opacity: x.kind === 'warmup' || x.kind === 'cooldown' ? 0.6 : 1 }} />)}
      </View>

      <View style={{ gap: space.sm }}>
        {rows.map((x) => (
          <Row key={x.kind} style={{ alignItems: 'flex-start' }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 6, backgroundColor: PHASE[x.kind].a }} />
            <View style={{ flex: 1 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T v="headline">{x.label}</T>
                <T v="headline" color={colors.dim} style={type.num}>{x.time}</T>
              </Row>
              <Detail cue={x.cue} pace={x.pace} unit={unit} />
            </View>
          </Row>
        ))}
      </View>

      <Press onPress={() => setSteps(!steps)} haptic={false}>
        <Row gap={6}>
          <T v="footnote" color={colors.cyan}>{steps ? 'Hide the steps' : `Every step (${phases.length})`}</T>
          <Icon name={steps ? 'chevron.up' : 'chevron.down'} size={11} color={colors.cyan} />
        </Row>
      </Press>
      {steps && (
        <Animated.View entering={reduced ? undefined : FadeIn.duration(180)} layout={reduced ? undefined : LinearTransition.duration(200)} style={{ gap: 6 }}>
          {phases.map((x, i) => (
            <Row key={i} style={{ alignItems: 'flex-start' }}>
              <T v="footnote" color={colors.faint} style={[type.num, { width: 22 }]}>{i + 1}</T>
              <View style={{ width: 6, height: 6, borderRadius: 3, marginTop: 6, backgroundColor: PHASE[x.kind].a }} />
              <View style={{ flex: 1 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <T v="callout">{NAME[x.kind]}{x.round && p.rounds > 1 ? ` ${x.round}/${p.rounds}` : ''} · {formatClock(x.seconds)}</T>
                  <T v="footnote" color={colors.faint} style={type.num}>{formatClock(x.start)}–{formatClock(x.end)}</T>
                </Row>
                <Detail cue={cueWords(x.cue)} pace={x.pace} unit={unit} />
              </View>
            </Row>
          ))}
        </Animated.View>
      )}

      <T v="footnote" color={colors.faint}>
        {p.countdown ? `${p.countdown} s countdown before each change` : 'No countdown beeps'}
        {tracksDistance(c.activity) ? ' · distance by GPS' : ''}
        {voice ? ' · voice coach on' : ''}
      </T>
      {!!c.notes && (
        <Press onPress={() => setMore(!more)} haptic={false}>
          <T v="callout" color={colors.dim} numberOfLines={more ? undefined : 3}>{c.notes}</T>
          {!more && c.notes.length > 140 && <T v="footnote" color={colors.cyan}>More</T>}
        </Press>
      )}
      <Row gap={space.sm}>
        <Button kind="secondary" icon="slider.horizontal.3" title="Edit" onPress={() => router.push({ pathname: '/cardio', params: { id: c.id } })} style={{ flex: 1 }} />
        {canStart && <Button title="Start" icon="play.fill" onPress={start} style={{ flex: 1 }} />}
      </Row>
    </Card>
  );
}

function Detail({ cue, pace, unit }: { cue: string; pace: PaceRange | null; unit: 'km' | 'mi' }) {
  if (!cue && !pace) return null;
  return (
    <Row gap={6} style={{ flexWrap: 'wrap' }}>
      {!!pace && <T v="footnote" color={colors.cyan} style={type.num}>{formatPaceRange(pace, unit)}</T>}
      {!!cue && <T v="footnote" color={colors.dim}>{cue}</T>}
    </Row>
  );
}

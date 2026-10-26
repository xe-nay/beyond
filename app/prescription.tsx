import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { exercise } from '../src/catalog';
import { ExerciseImage } from '../src/components/ExerciseImage';
import { Icon } from '../src/components/Icon';
import { Button, Chip, Press, Row, Stepper, T } from '../src/components/ui';
import { REGION_NAMES } from '../src/domain/calc';
import { formatClock } from '../src/domain/intervals';
import type { Prescription } from '../src/domain/types';
import { useStore } from '../src/store';
import { colors, space } from '../src/theme';

/** Edit sets, reps, effort, rest, warm-ups and superset group — for a session or a program day. */
export default function PrescriptionSheet() {
  const { session: sessionId, index, program, day } = useLocalSearchParams<{ session?: string; index: string; program?: string; day?: string }>();
  const router = useRouter();
  const s = useStore();
  const [howTo, setHowTo] = useState(false);
  const i = Number(index);
  const p = sessionId
    ? s.sessions.find((x) => x.id === sessionId)?.plan[i]
    : s.programs.find((x) => x.id === program)?.days.find((d) => d.id === day)?.exercises[i];
  if (!p) return null;
  const e = exercise(p.exerciseId);
  const patch = (x: Partial<Prescription> | null) => (sessionId ? s.patchPlan(sessionId, i, x) : s.updatePrescription(program!, day!, i, x));

  return (
    <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.xl }}>
      {e && (
        <View style={{ gap: space.md }}>
          {/* The demonstration loops start and peak frames of the movement. */}
          <ExerciseImage exercise={e} style={{ height: 220 }} />
          <View style={{ gap: 4 }}>
            <T v="title">{e.name}</T>
            <T v="footnote" color={colors.dim}>{e.primary.map((r) => REGION_NAMES[r]).join(' · ')}</T>
          </View>
          {e.steps.length > 0 && (
            <View style={{ gap: space.sm }}>
              <Press onPress={() => setHowTo(!howTo)}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <T v="headline" color={colors.cyan}>How to</T>
                  <Icon name={howTo ? 'chevron.down' : 'chevron.right'} size={14} color={colors.cyan} />
                </Row>
              </Press>
              {howTo && (
                <Animated.View entering={FadeIn.duration(180)} style={{ gap: space.sm }}>
                  {e.steps.map((step, n) => (
                    <Row key={n} style={{ alignItems: 'flex-start' }}>
                      <T v="headline" color={colors.cyan} style={{ width: 22 }}>{n + 1}</T>
                      <T v="callout" color={colors.dim} style={{ flex: 1 }}>{step}</T>
                    </Row>
                  ))}
                  <Press onPress={() => router.push(`/exercise/${e.id}`)}><T v="footnote" color={colors.faint}>Muscles, history and alternatives</T></Press>
                </Animated.View>
              )}
            </View>
          )}
        </View>
      )}
      <Row>
        <Stepper label="Sets" value={p.sets} onChange={(sets) => patch({ sets })} min={1} max={10} />
        <Stepper label="Warm-ups" value={p.warmupSets ?? 0} onChange={(warmupSets) => patch({ warmupSets })} min={0} max={5} />
      </Row>
      <Row>
        <Stepper label="Min reps" value={p.minReps} onChange={(minReps) => patch({ minReps, maxReps: Math.max(minReps, p.maxReps) })} min={1} max={50} />
        <Stepper label="Max reps" value={p.maxReps} onChange={(maxReps) => patch({ maxReps, minReps: Math.min(maxReps, p.minReps) })} min={1} max={50} />
      </Row>
      <Row>
        <Stepper label="Target RIR" value={p.rir} onChange={(rir) => patch({ rir })} min={0} max={5} />
        <Stepper label="Rest" value={p.restSeconds} onChange={(restSeconds) => patch({ restSeconds })} step={15} min={15} max={600} clock format={formatClock} />
      </Row>
      <View style={{ gap: space.sm }}>
        <T v="caption" color={colors.faint}>Superset</T>
        <Row gap={space.sm}>
          {['', 'A', 'B', 'C'].map((g) => (
            <Chip key={g} label={g || 'None'} active={(p.superset ?? '') === g} onPress={() => patch({ superset: g || undefined })} />
          ))}
        </Row>
      </View>
      <Row>
        <Button style={{ flex: 1 }} title="Done" onPress={() => router.back()} />
        <Button kind="danger" icon="trash" onPress={() => { patch(null); router.back(); }} />
      </Row>
    </ScrollView>
  );
}

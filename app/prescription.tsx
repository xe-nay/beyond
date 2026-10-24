import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { exercise } from '../src/catalog';
import { Button, Chip, Row, Stepper, T } from '../src/components/ui';
import { formatClock } from '../src/domain/intervals';
import type { Prescription } from '../src/domain/types';
import { useStore } from '../src/store';
import { colors, space } from '../src/theme';

/** Edit sets, reps, effort, rest, warm-ups and superset group — for a session or a program day. */
export default function PrescriptionSheet() {
  const { session: sessionId, index, program, day } = useLocalSearchParams<{ session?: string; index: string; program?: string; day?: string }>();
  const router = useRouter();
  const s = useStore();
  const i = Number(index);
  const p = sessionId
    ? s.sessions.find((x) => x.id === sessionId)?.plan[i]
    : s.programs.find((x) => x.id === program)?.days.find((d) => d.id === day)?.exercises[i];
  if (!p) return null;
  const patch = (x: Partial<Prescription> | null) => (sessionId ? s.patchPlan(sessionId, i, x) : s.updatePrescription(program!, day!, i, x));

  return (
    <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.xl }}>
      <T v="title">{exercise(p.exerciseId)?.name}</T>
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
        <Stepper label="Rest" value={p.restSeconds} onChange={(restSeconds) => patch({ restSeconds })} step={15} min={15} max={600} format={formatClock} />
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

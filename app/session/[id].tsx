import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import { exercise } from '../../src/catalog';
import { ExerciseImage } from '../../src/components/ExerciseImage';
import { Button, Card, Row, Screen, Stat, T } from '../../src/components/ui';
import { e1rm, groupByExercise, repDrop, sessionLoad, sessionMinutes, volumeLoad, working } from '../../src/domain/calc';
import { formatWeight, toDisplay } from '../../src/domain/plates';
import { useStore } from '../../src/store';
import { colors, space, type } from '../../src/theme';

export default function SessionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const s = useStore();
  const x = s.sessions.find((y) => y.id === id);
  if (!x) return null;
  const unit = s.profile.unit;
  const minutes = sessionMinutes(x);
  const load = sessionLoad(x);

  return (
    <Screen>
      <Stack.Screen options={{ title: x.name }} />
      <T v="label" color={colors.dim}>{new Date(`${x.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</T>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Stat small label="Minutes" value={minutes ? Math.round(minutes) : '—'} />
          <Stat small label="Sets" value={working(x.sets).length} />
          <Stat small label="Volume" value={Math.round(toDisplay(volumeLoad(x.sets), unit)).toLocaleString()} unit={unit} />
          <Stat small label="sRPE" value={load ? Math.round(load) : '—'} />
        </Row>
      </Card>
      {groupByExercise(x.sets).map((g) => {
        const e = exercise(g.exerciseId);
        const drop = repDrop(g.sets);
        const best = Math.max(0, ...working(g.sets).map((y) => e1rm(y.loadKg, y.reps) ?? 0));
        return (
          <Card key={g.exerciseId}>
            <Row>
              {e && <ExerciseImage exercise={e} thumb style={{ width: 44, height: 44 }} />}
              <View style={{ flex: 1 }}>
                <T v="headline">{e?.name ?? g.exerciseId}</T>
                <T v="label" color={colors.dim}>{best ? `e1RM ${formatWeight(best, unit)} ${unit}` : ''}{drop ? ` · rep drop ${Math.round(drop.percent)}%` : ''}</T>
              </View>
            </Row>
            {g.sets.map((y, i) => (
              <Row key={y.id} style={{ justifyContent: 'space-between' }}>
                <T v="label" color={y.warmup ? colors.amber : colors.dim} style={{ width: 24 }}>{y.warmup ? 'W' : i + 1}</T>
                <T v="headline" style={[type.num, { flex: 1 }]}>{y.implements === 2 ? "2 × " : ""}{formatWeight(y.loadKg, unit)} {unit} × {y.reps}</T>
                <T v="label" color={colors.dim} style={type.num}>{y.rir !== null ? `RIR ${y.rir}` : ''}{y.restSeconds ? ` · ${Math.round(y.restSeconds)}s` : ''}</T>
              </Row>
            ))}
          </Card>
        );
      })}
      {!!x.notes && <Card><T color={colors.dim}>{x.notes}</T></Card>}
      <Button kind="danger" icon="trash" title="Delete workout" onPress={() => { s.discardSession(x.id); router.back(); }} />
      <View style={{ height: space.xl }} />
    </Screen>
  );
}

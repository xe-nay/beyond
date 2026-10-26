import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import Animated, { FadeIn, LinearTransition, useReducedMotion } from 'react-native-reanimated';

import { exercise } from '../../src/catalog';
import { ExerciseImage } from '../../src/components/ExerciseImage';
import { Icon } from '../../src/components/Icon';
import { Button, Card, Chip, Press, Row, Screen, Segmented, Stat, Stepper, T, Toggle } from '../../src/components/ui';
import { e1rm, groupByExercise, repDrop, restBefore, sessionLoad, sessionMinutes, volumeLoad, working } from '../../src/domain/calc';
import { formatClock } from '../../src/domain/intervals';
import { formatWeight, toDisplay, toKg } from '../../src/domain/plates';
import type { WorkoutSet } from '../../src/domain/types';
import { useStore } from '../../src/store';
import { alpha, colors, radius, space, type } from '../../src/theme';

/** A finished workout: every set, and (Edit) changing weights, reps, RIR, warm-ups, adding or removing sets. */
export default function SessionDetail() {
  const { id, edit } = useLocalSearchParams<{ id: string; edit?: string }>();
  const router = useRouter();
  const reduced = useReducedMotion();
  const s = useStore();
  const [editing, setEditing] = useState(edit === '1');
  const [open, setOpen] = useState<string | null>(null);
  const x = s.sessions.find((y) => y.id === id);
  if (!x) return null;
  const unit = s.profile.unit;
  const minutes = sessionMinutes(x);
  const load = sessionLoad(x);

  const removeWorkout = () => {
    const go = () => { s.discardSession(x.id); router.back(); };
    if (Platform.OS === 'web') return go();
    Alert.alert('Delete this workout?', 'Its sets leave your history, records and charts.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: go }]);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: x.name, headerRight: () => <Press onPress={() => { setEditing(!editing); setOpen(null); }} hitSlop={10}><T v="headline" color={colors.cyan}>{editing ? 'Done' : 'Edit'}</T></Press> }} />
      <T v="label" color={colors.dim}>{new Date(`${x.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</T>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Stat small label="Minutes" value={minutes ? Math.round(minutes) : '—'} />
          <Stat small label="Sets" value={working(x.sets).length} />
          <Stat small label="Volume" value={Math.round(toDisplay(volumeLoad(x.sets), unit)).toLocaleString()} unit={unit} />
          <Stat small label="sRPE" value={load ? Math.round(load) : '—'} />
        </Row>
      </Card>
      {editing && <T v="footnote" color={colors.cyan}>Tap a set to change it. Volume, records and charts follow.</T>}
      {groupByExercise(x.sets).map((g) => {
        const e = exercise(g.exerciseId);
        const drop = repDrop(g.sets);
        const best = Math.max(0, ...working(g.sets).map((y) => e1rm(y.loadKg, y.reps) ?? 0));
        let n = 0;
        return (
          <Card key={g.exerciseId}>
            <Row>
              {e && <ExerciseImage exercise={e} thumb style={{ width: 44, height: 44 }} />}
              <View style={{ flex: 1 }}>
                <T v="headline">{e?.name ?? g.exerciseId}</T>
                <T v="label" color={colors.dim}>{best ? `e1RM ${formatWeight(best, unit)} ${unit}` : ''}{drop ? ` · rep drop ${Math.round(drop.percent)}%` : ''}</T>
              </View>
            </Row>
            {g.sets.map((y) => {
              const label = y.warmup ? 'W' : String(++n);
              const rest = restBefore(x.sets, x.sets.indexOf(y));
              return (
                <Animated.View key={y.id} layout={reduced ? undefined : LinearTransition.duration(200)}>
                  <Press onPress={() => editing && setOpen(open === y.id ? null : y.id)} haptic={false} disabled={!editing}>
                    <Row style={[{ justifyContent: 'space-between', paddingVertical: 4 }, editing && { paddingHorizontal: 8, borderRadius: radius.sm, backgroundColor: open === y.id ? alpha(colors.cyan, 0.1) : colors.surface2 }]}>
                      <T v="label" color={y.warmup ? colors.amber : colors.dim} style={{ width: 24 }}>{label}</T>
                      <T v="headline" style={[type.num, { flex: 1 }]}>{y.implements === 2 ? '2 × ' : ''}{formatWeight(y.loadKg, unit)} {unit} × {y.reps}</T>
                      <T v="label" color={colors.dim} style={type.num}>{y.rir !== null ? `RIR ${y.rir}` : ''}{rest ? ` · ${formatClock(rest)} rest` : ''}</T>
                      {editing && <Icon name={open === y.id ? 'chevron.down' : 'pencil'} size={13} color={colors.cyan} style={{ marginLeft: 8 }} />}
                    </Row>
                  </Press>
                  {editing && open === y.id && <SetEditor set={y} unit={unit} onChange={(patch) => s.updateSet(x.id, y.id, patch)} onDelete={() => { s.deleteSet(x.id, y.id); setOpen(null); }} onCopy={() => s.addSet(x.id, y)} />}
                </Animated.View>
              );
            })}
          </Card>
        );
      })}
      {!!x.notes && <Card><T color={colors.dim}>{x.notes}</T></Card>}
      <Button kind="danger" icon="trash" title="Delete workout" onPress={removeWorkout} />
      <View style={{ height: space.xl }} />
    </Screen>
  );
}

function SetEditor({ set, unit, onChange, onDelete, onCopy }: { set: WorkoutSet; unit: 'kg' | 'lb'; onChange: (p: Partial<WorkoutSet>) => void; onDelete: () => void; onCopy: () => void }) {
  const shown = toDisplay(set.loadKg, unit);
  const step = unit === 'kg' ? (shown < 20 ? 0.5 : 2.5) : 5;
  return (
    <Animated.View entering={FadeIn.duration(160)} style={{ gap: space.md, paddingVertical: space.md }}>
      <Row>
        <Stepper label={set.implements === 2 ? `Weight each (${unit})` : `Weight (${unit})`} value={shown} onChange={(v) => onChange({ loadKg: toKg(Math.max(0, v), unit) })} step={step} min={0} max={1000} format={(v) => formatWeight(toKg(v, unit), unit)} />
        <Stepper label="Reps" value={set.reps} onChange={(reps) => onChange({ reps })} min={0} max={100} />
      </Row>
      {set.implements !== undefined && (
        // Dumbbells: the weight is per dumbbell; volume counts both when there are two.
        <View style={{ gap: 6 }}>
          <Segmented<1 | 2> value={set.implements} onChange={(n) => onChange({ implements: n })} options={[{ value: 1, label: 'One dumbbell' }, { value: 2, label: 'Two (weight each)' }]} />
          <T v="footnote" color={colors.faint}>Counts as {formatWeight(set.loadKg * set.implements, unit)} {unit} a rep in volume.</T>
        </View>
      )}
      <View style={{ gap: 6 }}>
        <T v="caption" color={colors.faint}>RIR</T>
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          {[null, 0, 1, 2, 3, 4, 5].map((r) => <Chip key={String(r)} label={r === null ? '—' : String(r)} active={set.rir === r} onPress={() => onChange({ rir: r })} />)}
        </Row>
      </View>
      <Row style={{ justifyContent: 'space-between' }}>
        <T v="callout">Warm-up set</T>
        <Toggle value={set.warmup} onChange={(warmup) => onChange({ warmup })} />
      </Row>
      <Row gap={space.sm}>
        <Button small kind="secondary" icon="plus" title="Add a set like this" onPress={onCopy} style={{ flex: 1 }} />
        <Button small kind="danger" icon="trash" onPress={onDelete} />
      </Row>
    </Animated.View>
  );
}

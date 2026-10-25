import { Stack, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { Platform, TextInput, View } from 'react-native';

import { exercise } from '../src/catalog';
import { ExerciseImage } from '../src/components/ExerciseImage';
import { Icon } from '../src/components/Icon';
import { Button, Card, Press, Row, Screen, Section, T } from '../src/components/ui';
import { weekStart } from '../src/domain/calc';
import { weekTemplate } from '../src/domain/importer';
import { formatClock } from '../src/domain/intervals';
import { cacheText } from '../src/storage';
import { dayLabel } from '../src/meals';
import { activeProgram, useStore } from '../src/store';
import { alpha, colors, radius, space } from '../src/theme';

const WD = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function ProgramEditor() {
  const router = useRouter();
  const s = useStore();
  const program = activeProgram(s);
  if (!program) return null;
  const save = (patch: Partial<typeof program>) => s.saveProgram({ ...program, ...patch });

  const exportWeek = async () => {
    const file = weekTemplate(program.name, weekStart(), program.days);
    const uri = cacheText(`beyond-week-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(file, null, 2));
    if (Platform.OS !== 'web') await Sharing.shareAsync(uri, { mimeType: 'application/json' });
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: program.name, headerRight: () => <Press onPress={exportWeek}><Icon name="square.and.arrow.up" size={18} color={colors.cyan} /></Press> }} />
      <TextInput defaultValue={program.name} onEndEditing={(e) => save({ name: e.nativeEvent.text || program.name })} style={{ color: colors.text, fontSize: 17, fontWeight: '600', backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md }} />
      {program.days.map((d) => (
        <Section key={d.id} title={d.name}>
          <Card style={{ gap: space.sm }}>
            <Row gap={6}>
              {WD.map((w, i) => (
                <Press key={i} onPress={() => save({ days: program.days.map((x) => (x.id === d.id ? { ...x, weekday: i } : x)).sort((a, b) => a.weekday - b.weekday) })}
                  style={{ flex: 1, height: 32, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: d.weekday === i ? colors.cyan : colors.surface2 }}>
                  <T v="label" color={d.weekday === i ? colors.black : colors.dim} style={{ fontWeight: '700' }}>{w}</T>
                </Press>
              ))}
            </Row>
            {d.exercises.map((x, i) => {
              const e = exercise(x.exerciseId);
              return (
                <Row key={`${x.exerciseId}-${i}`} style={{ paddingVertical: 4 }}>
                  {e && <ExerciseImage exercise={e} thumb style={{ width: 44, height: 44 }} />}
                  <Press style={{ flex: 1 }} haptic={false} onPress={() => router.push({ pathname: '/prescription', params: { program: program.id, day: d.id, index: i } })}>
                    <T v="headline" numberOfLines={1}>{e?.name ?? x.exerciseId}</T>
                    <T v="label" color={colors.dim}>
                      {x.sets} × {x.minReps}–{x.maxReps} · RIR {x.rir} · {formatClock(x.restSeconds)}{x.superset ? ` · ${x.superset}` : ''}
                    </T>
                  </Press>
                  <Press onPress={() => router.push({ pathname: '/swap', params: { program: program.id, day: d.id, index: i } })} hitSlop={8}>
                    <Icon name="arrow.left.arrow.right" size={14} color={colors.cyan} />
                  </Press>
                </Row>
              );
            })}
            <Row>
              <Button small kind="secondary" icon="plus" title="Exercise" onPress={() => router.push({ pathname: '/library', params: { pick: `${program.id}:${d.id}` } })} />
              <View style={{ flex: 1 }} />
              <Press onPress={() => save({ days: program.days.filter((x) => x.id !== d.id) })}><Icon name="trash" size={15} color={colors.faint} /></Press>
            </Row>
          </Card>
        </Section>
      ))}
      <Button kind="secondary" icon="plus" title="Add day" onPress={() => {
        const used = new Set(program.days.map((x) => x.weekday));
        const weekday = [0, 1, 2, 3, 4, 5, 6].find((x) => !used.has(x)) ?? 6;
        save({ days: [...program.days, { id: `d${Date.now()}`, name: `Day ${program.days.length + 1}`, weekday, exercises: [] }].sort((a, b) => a.weekday - b.weekday) });
      }} />
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <T v="headline">Deload</T>
            <T v="label" color={colors.dim}>{program.deloadEvery ? `Lighter week every ${program.deloadEvery} weeks` : 'Off'}</T>
          </View>
          <Row gap={6}>
            {[null, 4, 6, 8].map((n) => (
              <Press key={String(n)} onPress={() => save({ deloadEvery: n })} style={{ paddingHorizontal: 12, height: 32, borderRadius: radius.pill, justifyContent: 'center', backgroundColor: program.deloadEvery === n ? alpha(colors.cyan, 0.2) : colors.surface2 }}>
                <T v="label" color={program.deloadEvery === n ? colors.cyan : colors.dim}>{n ?? 'Off'}</T>
              </Press>
            ))}
          </Row>
        </Row>
      </Card>
      <T v="footnote" color={colors.faint} style={{ textAlign: 'center' }}>
        {program.from || program.until ? `Plans ${program.from ? dayLabel(program.from) : 'now'} → ${program.until ? dayLabel(program.until) : 'no end'}` : 'Plans every week, after any imported plan'}
      </T>
      <Button kind="lime" icon="wand.and.stars" title="Build a new program" onPress={() => router.push('/templates')} />
    </Screen>
  );
}

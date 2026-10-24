import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { exercise } from '../../../src/catalog';
import { Icon, type IconName } from '../../../src/components/Icon';
import { Button, Card, Empty, Press, Row, Screen, Section, T } from '../../../src/components/ui';
import { volumeLoad, working } from '../../../src/domain/calc';
import { toDisplay } from '../../../src/domain/plates';
import { activeProgram, useStore } from '../../../src/store';
import { alpha, colors, radius, space } from '../../../src/theme';

const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function Train() {
  const router = useRouter();
  const s = useStore();
  const program = activeProgram(s);
  const history = s.sessions.filter((x) => x.finishedAt).sort((a, b) => b.finishedAt!.localeCompare(a.finishedAt!));
  const planned = s.sessions.filter((x) => !x.finishedAt && !x.startedAt).sort((a, b) => a.date.localeCompare(b.date));
  const start = (input: Parameters<typeof s.startSession>[0]) => {
    s.startSession(input);
    router.push('/workout');
  };

  return (
    <Screen>
      <Row gap={space.sm}>
        <Action icon="play.fill" label="Start" onPress={() => start({ empty: true })} tint />
        <Action icon="figure.run" label="Cardio" onPress={() => router.push('/cardio')} />
        <Action icon="list.bullet" label="Library" onPress={() => router.push('/library')} />
        <Action icon="square.and.arrow.down" label="Import" onPress={() => router.push('/import')} />
      </Row>

      <Section title="Program" action={<Press onPress={() => router.push('/templates')}><T v="label" color={colors.cyan}>Change</T></Press>}>
        {program ? (
          <Card style={{ padding: 0, gap: 0 }}>
            <Press onPress={() => router.push('/program')}>
              <Row style={{ padding: space.lg, justifyContent: 'space-between' }}>
                <View>
                  <T v="title">{program.name}</T>
                  <T v="label" color={colors.dim}>{program.days.length} days a week</T>
                </View>
                <Icon name="chevron.right" size={14} color={colors.faint} />
              </Row>
            </Press>
            {program.days.map((d) => (
              <Row key={d.id} style={{ paddingHorizontal: space.lg, paddingVertical: space.md, borderTopWidth: 0.5, borderTopColor: colors.hairline }}>
                <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
                  <T v="caption" color={colors.cyan}>{WD[d.weekday]}</T>
                </View>
                <View style={{ flex: 1 }}>
                  <T v="headline">{d.name}</T>
                  <T v="label" color={colors.dim} numberOfLines={1}>{d.exercises.map((x) => exercise(x.exerciseId)?.name).join(' · ')}</T>
                </View>
                <Press onPress={() => start({ dayId: d.id })} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: alpha(colors.cyan, 0.15), alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="play.fill" size={14} color={colors.cyan} />
                </Press>
              </Row>
            ))}
          </Card>
        ) : (
          <Card><Empty icon="dumbbell.fill" title="No program" action={<Button small title="Pick a template" onPress={() => router.push('/templates')} />} /></Card>
        )}
      </Section>

      {planned.length > 0 && (
        <Section title="Planned">
          {planned.slice(0, 6).map((x) => (
            <Card key={x.id} onPress={() => start({ sessionId: x.id })} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <T v="headline">{x.name}</T>
                <T v="label" color={colors.dim}>{new Date(`${x.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · {x.plan.length} exercises</T>
              </View>
              <Icon name="play.fill" size={14} color={colors.cyan} />
            </Card>
          ))}
        </Section>
      )}

      <Section title="History">
        {history.length ? history.slice(0, 20).map((x) => (
          <Card key={x.id} onPress={() => router.push(`/session/${x.id}`)} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1, gap: 2 }}>
              <T v="headline">{x.name}</T>
              <T v="label" color={colors.dim}>
                {new Date(`${x.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · {working(x.sets).length} sets · {Math.round(toDisplay(volumeLoad(x.sets), s.profile.unit)).toLocaleString()} {s.profile.unit}
              </T>
            </View>
            <Icon name="chevron.right" size={14} color={colors.faint} />
          </Card>
        )) : <T v="label" color={colors.faint} style={{ paddingHorizontal: 4 }}>Finished workouts appear here.</T>}
      </Section>
    </Screen>
  );
}

function Action({ icon, label, onPress, tint }: { icon: IconName; label: string; onPress: () => void; tint?: boolean }) {
  return (
    <Press onPress={onPress} style={{ flex: 1, aspectRatio: 0.95, borderRadius: radius.lg, padding: space.md, justifyContent: 'space-between', backgroundColor: tint ? colors.cyan : colors.surface, borderWidth: 0.5, borderColor: colors.hairline }}>
      <Icon name={icon} size={20} color={tint ? colors.black : colors.cyan} />
      <T v="footnote" numberOfLines={1} color={tint ? colors.black : colors.text} style={{ fontWeight: '600' }}>{label}</T>
    </Press>
  );
}

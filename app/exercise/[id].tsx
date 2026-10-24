import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import { byId, EQUIPMENT_LABEL, exercises } from '../../src/catalog';
import { BodyMap } from '../../src/components/BodyMap';
import { ExerciseImage } from '../../src/components/ExerciseImage';
import { Card, Chip, Press, Row, Screen, Section, Stat, T } from '../../src/components/ui';
import { bestSet, REGION_NAMES, strengthTrend } from '../../src/domain/calc';
import { formatWeight } from '../../src/domain/plates';
import { substitutes } from '../../src/domain/program';
import { useStore } from '../../src/store';
import { colors, space } from '../../src/theme';
import { LineChart } from '../../src/components/Charts';

export default function ExerciseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const s = useStore();
  const e = byId[id];
  if (!e) return null;
  const done = s.sessions.filter((x) => x.finishedAt);
  const best = bestSet(done, e.id);
  const trend = strengthTrend(done, e.id);
  const unit = s.profile.unit;
  const alts = substitutes(e, exercises, s.profile.equipment, 6);

  return (
    <Screen>
      <Stack.Screen options={{ title: e.name }} />
      <ExerciseImage exercise={e} style={{ height: 260 }} />
      <View style={{ gap: space.sm }}>
        <T v="title">{e.name}</T>
        <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
          <Chip label={EQUIPMENT_LABEL[e.equipment]} />
          <Chip label={e.level} />
          {e.mechanic && <Chip label={e.mechanic} />}
          {e.unilateral && <Chip label="one side" />}
        </Row>
      </View>
      {!!e.description && <T color={colors.dim}>{e.description}</T>}

      {(best || trend.length > 1) && (
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            {best && <Stat small label="Best e1RM" value={formatWeight(best.e1rm, unit)} unit={unit} color={colors.lime} />}
            {best && <Stat small label="Best set" value={`${formatWeight(best.set.loadKg, unit)}×${best.set.reps}`} />}
          </Row>
          {trend.length > 1 && <LineChart data={trend.map((t) => t.value)} height={90} />}
        </Card>
      )}

      <Card style={{ alignItems: 'center' }}>
        <BodyMap primary={e.primary} secondary={e.secondary} scale={0.85} />
        <T v="label" color={colors.dim} style={{ textAlign: 'center' }}>
          {e.primary.map((r) => REGION_NAMES[r]).join(' · ')}{e.secondary.length ? `  +  ${e.secondary.map((r) => REGION_NAMES[r]).join(' · ')}` : ''}
        </T>
      </Card>

      {e.steps.length > 0 && (
        <Section title="How to">
          <Card>
            {e.steps.map((step, i) => (
              <Row key={i} style={{ alignItems: 'flex-start' }}>
                <T v="headline" color={colors.cyan} style={{ width: 22 }}>{i + 1}</T>
                <T style={{ flex: 1 }} color={colors.dim}>{step}</T>
              </Row>
            ))}
          </Card>
        </Section>
      )}
      {e.tips.length > 0 && (
        <Section title="Tips">
          <Card>{e.tips.map((t, i) => <T key={i} color={colors.dim}>{t}</T>)}</Card>
        </Section>
      )}
      {alts.length > 0 && (
        <Section title="Alternatives">
          {alts.map((a) => (
            <Press key={a.id} onPress={() => router.push(`/exercise/${a.id}`)}>
              <Row>
                <ExerciseImage exercise={a} thumb style={{ width: 48, height: 48 }} />
                <View style={{ flex: 1 }}>
                  <T v="headline" numberOfLines={1}>{a.name}</T>
                  <T v="label" color={colors.dim}>{EQUIPMENT_LABEL[a.equipment]}</T>
                </View>
              </Row>
            </Press>
          ))}
        </Section>
      )}
      <T v="caption" color={colors.faint} style={{ textAlign: 'center', textTransform: 'none' }}>
        {e.src === 'r' ? 'Exercise data by RepDB (repdb.co)' : 'free-exercise-db (public domain)'}
      </T>
    </Screen>
  );
}

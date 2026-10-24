import { useLocalSearchParams, useRouter } from 'expo-router';
import { FlatList, View } from 'react-native';

import { byId, EQUIPMENT_LABEL, exercises } from '../src/catalog';
import { ExerciseImage } from '../src/components/ExerciseImage';
import { Icon } from '../src/components/Icon';
import { Press, Row, T } from '../src/components/ui';
import { REGION_NAMES } from '../src/domain/calc';
import { substitutes } from '../src/domain/program';
import { useStore } from '../src/store';
import { colors, space } from '../src/theme';

/** Swap an exercise in the running session for one hitting the same muscles with your equipment. */
export default function Swap() {
  const { session: sessionId, index, program, day } = useLocalSearchParams<{ session?: string; index: string; program?: string; day?: string }>();
  const router = useRouter();
  const s = useStore();
  const i = Number(index);
  const current = sessionId
    ? s.sessions.find((x) => x.id === sessionId)?.plan[i]
    : s.programs.find((x) => x.id === program)?.days.find((d) => d.id === day)?.exercises[i];
  const e = current && byId[current.exerciseId];
  if (!e || !current) return null;
  const list = substitutes(e, exercises, s.profile.equipment, 20);

  return (
    <FlatList
      data={list}
      keyExtractor={(x) => x.id}
      contentContainerStyle={{ padding: space.xl, gap: space.sm }}
      ListHeaderComponent={
        <View style={{ gap: 4, marginBottom: space.md }}>
          <T v="title">Swap {e.name}</T>
          <T v="label" color={colors.dim}>Same main muscles, your equipment. Load resets for the new exercise.</T>
        </View>
      }
      renderItem={({ item }) => (
        <Press
          onPress={() => {
            const patch = { exerciseId: item.id, loadKg: null };
            if (sessionId) s.patchPlan(sessionId, i, patch);
            else s.updatePrescription(program!, day!, i, patch);
            router.back();
          }}>
          <Row style={{ paddingVertical: 6 }}>
            <ExerciseImage exercise={item} thumb style={{ width: 52, height: 52 }} />
            <View style={{ flex: 1, gap: 2 }}>
              <T v="headline" numberOfLines={1}>{item.name}</T>
              <T v="label" color={colors.dim} numberOfLines={1}>{EQUIPMENT_LABEL[item.equipment]} · {item.primary.map((r) => REGION_NAMES[r]).join(', ')}</T>
            </View>
            <Icon name="arrow.left.arrow.right" size={14} color={colors.cyan} />
          </Row>
        </Press>
      )}
    />
  );
}

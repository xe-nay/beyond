import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useDeferredValue, useMemo, useState } from 'react';
import { FlatList, ScrollView, View } from 'react-native';

import { EQUIPMENT_LABEL, search } from '../src/catalog';
import { ExerciseImage } from '../src/components/ExerciseImage';
import { Icon } from '../src/components/Icon';
import { Chip, Press, Row, T } from '../src/components/ui';
import { REGION_NAMES, REGIONS } from '../src/domain/calc';
import type { Equipment, Region } from '../src/domain/types';
import { useStore } from '../src/store';
import { colors, space } from '../src/theme';

const GEAR: Equipment[] = ['barbell', 'dumbbell', 'kettlebell', 'cable', 'machine', 'bodyweight', 'band'];

/** The full catalog. With ?pick=session or ?pick=<programId>:<dayId> a tap adds the exercise there. */
export default function Library() {
  const { pick } = useLocalSearchParams<{ pick?: string }>();
  const router = useRouter();
  const s = useStore();
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState<Region | null>(null);
  const [gear, setGear] = useState<Equipment | null>(null);
  const [home, setHome] = useState(false);
  const q = useDeferredValue(query);
  const list = useMemo(() => search(q, { region, equipment: gear, home }), [q, region, gear, home]);

  const choose = (id: string) => {
    if (pick === 'session' && s.activeSession) {
      s.addPlanExercise(s.activeSession, id);
      return router.back();
    }
    if (pick?.includes(':')) {
      const [programId, dayId] = pick.split(':');
      s.addToDay(programId, dayId, id);
      return router.back();
    }
    router.push(`/exercise/${id}`);
  };

  return (
    <>
      <Stack.Screen options={{ title: pick ? 'Add exercise' : 'Exercises', headerSearchBarOptions: { placeholder: `Search ${list.length} exercises`, onChangeText: (e) => setQuery(e.nativeEvent.text), tintColor: colors.cyan, textColor: colors.text, hideWhenScrolling: false } }} />
      <FlatList
        style={{ backgroundColor: colors.black }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        data={list}
        keyExtractor={(x) => x.id}
        initialNumToRender={14}
        ListHeaderComponent={
          <View style={{ gap: space.sm, paddingVertical: space.md }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg }}>
              <Chip label="Home" icon="figure.walk" active={home} onPress={() => setHome(!home)} />
              {GEAR.map((g) => <Chip key={g} label={EQUIPMENT_LABEL[g]} active={gear === g} onPress={() => setGear(gear === g ? null : g)} />)}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingHorizontal: space.lg }}>
              {REGIONS.filter((r) => r !== 'neck' && r !== 'tibialis').map((r) => <Chip key={r} label={REGION_NAMES[r]} active={region === r} onPress={() => setRegion(region === r ? null : r)} />)}
            </ScrollView>
          </View>
        }
        renderItem={({ item }) => (
          <Press onPress={() => choose(item.id)} haptic={!!pick}>
            <Row style={{ paddingHorizontal: space.lg, paddingVertical: 7 }}>
              <ExerciseImage exercise={item} thumb style={{ width: 56, height: 56 }} />
              <View style={{ flex: 1, gap: 2 }}>
                <T v="headline" numberOfLines={1}>{item.name}</T>
                <T v="label" color={colors.dim} numberOfLines={1}>{EQUIPMENT_LABEL[item.equipment]} · {item.primary.map((r) => REGION_NAMES[r]).join(', ') || item.category}</T>
              </View>
              <Icon name={pick ? 'plus' : 'chevron.right'} size={14} color={pick ? colors.cyan : colors.faint} />
            </Row>
          </Press>
        )}
        ListFooterComponent={<T v="caption" color={colors.faint} style={{ textAlign: 'center', padding: space.xl, textTransform: 'none' }}>Exercise data by RepDB (repdb.co) and free-exercise-db</T>}
      />
    </>
  );
}

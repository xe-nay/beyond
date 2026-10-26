import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, ScrollView } from 'react-native';

import { Button, Press, Row, Stepper, T } from '../src/components/ui';
import { pace } from '../src/domain/intervals';
import { useStore } from '../src/store';
import { colors, space } from '../src/theme';

/** A finished cardio session's numbers: time, distance, effort, heart rate. */
export default function CardioEdit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const s = useStore();
  const c = s.cardio.find((x) => x.id === id);
  const [v, setV] = useState({ minutes: c?.minutes ?? 30, km: c?.distanceKm ?? 0, rpe: c?.rpe ?? 6, hr: c?.avgHr ?? 0 });
  if (!c) return null;
  const remove = () => {
    const go = () => { s.deleteCardio(c.id); router.back(); };
    if (Platform.OS === 'web') return go();
    Alert.alert('Delete this session?', undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: go }]);
  };
  return (
    <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.xl, paddingBottom: 80 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <T v="title">{c.name ?? c.activity}</T>
      <Row>
        <Stepper label="Minutes" value={v.minutes} onChange={(minutes) => setV({ ...v, minutes })} step={1} min={1} max={600} />
        <Stepper label="Km" value={v.km} onChange={(km) => setV({ ...v, km })} step={0.1} max={300} format={(x) => x.toFixed(2)} />
      </Row>
      <Row>
        <Stepper label="Effort (RPE)" value={v.rpe} onChange={(rpe) => setV({ ...v, rpe })} min={1} max={10} />
        <Stepper label="Avg HR" value={v.hr} onChange={(hr) => setV({ ...v, hr })} step={1} max={230} format={(x) => (x ? String(x) : '—')} />
      </Row>
      {!!pace(v.minutes, v.km) && <T v="label" color={colors.dim} style={{ textAlign: 'center' }}>{pace(v.minutes, v.km)}</T>}
      <Button kind="lime" icon="checkmark" title="Save" onPress={() => {
        s.saveCardio({ ...c, minutes: v.minutes, distanceKm: v.km || null, rpe: v.rpe, avgHr: v.hr || null });
        router.back();
      }} />
      <Press onPress={remove}><T v="label" color={colors.red} style={{ textAlign: 'center' }}>Delete session</T></Press>
    </ScrollView>
  );
}

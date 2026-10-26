import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView } from 'react-native';

import { Button, Row, Stepper, T } from '../src/components/ui';
import { startingTargets } from '../src/domain/nutrition';
import { latestWeight, useStore } from '../src/store';
import { colors, space } from '../src/theme';

export default function Targets() {
  const router = useRouter();
  const s = useStore();
  const [t, setT] = useState(s.targets);
  const estimate = startingTargets(s.profile, latestWeight(s));
  const kcalFromMacros = t.protein * 4 + t.carbs * 4 + t.fat * 9;
  return (
    <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.xl, paddingBottom: 120 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive">
      <T v="title">Daily targets</T>
      <T v="footnote" color={colors.dim}>Tap a number to type your own goal, or use − and +.</T>
      <Stepper label="Calories" value={t.kcal} onChange={(kcal) => setT({ ...t, kcal })} step={50} min={800} max={8000} big />
      <Row>
        <Stepper label="Protein g" value={t.protein} onChange={(protein) => setT({ ...t, protein })} step={5} max={400} />
        <Stepper label="Carbs g" value={t.carbs} onChange={(carbs) => setT({ ...t, carbs })} step={5} max={800} />
      </Row>
      <Row><Stepper label="Fat g" value={t.fat} onChange={(fat) => setT({ ...t, fat })} step={5} max={300} /></Row>
      <T v="label" color={Math.abs(kcalFromMacros - t.kcal) > 150 ? colors.amber : colors.faint} style={{ textAlign: 'center' }}>Macros add up to {kcalFromMacros} kcal</T>
      {estimate && (
        <Button kind="secondary" icon="wand.and.stars" title={`Use estimate · ${estimate.kcal} kcal`} onPress={() => setT(estimate)} />
      )}
      <Button title="Save" icon="checkmark" onPress={() => { s.set({ targets: t }); router.back(); }} />
      <T v="caption" color={colors.faint} style={{ textTransform: 'none', letterSpacing: 0, textAlign: 'center' }}>Estimate: Mifflin–St Jeor × activity from your training days, adjusted for your goal. A starting point, not a measurement.</T>
    </ScrollView>
  );
}

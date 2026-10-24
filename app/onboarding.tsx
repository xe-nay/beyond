import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '../src/components/Icon';
import { Button, Chip, Press, Row, Segmented, Stepper, T } from '../src/components/ui';
import type { Equipment, Experience, Goal, Unit } from '../src/domain/types';
import { startingTargets } from '../src/domain/nutrition';
import { today, uid, useStore } from '../src/store';
import { alpha, colors, radius, space } from '../src/theme';

const GOALS: { value: Goal; label: string; icon: IconName }[] = [
  { value: 'hypertrophy', label: 'Build muscle', icon: 'figure.strengthtraining.traditional' },
  { value: 'strength', label: 'Get stronger', icon: 'bolt.fill' },
  { value: 'fat-loss', label: 'Lose fat', icon: 'flame.fill' },
  { value: 'recomposition', label: 'Recomposition', icon: 'arrow.triangle.2.circlepath' },
  { value: 'hybrid', label: 'Strength + cardio', icon: 'figure.run' },
  { value: 'general', label: 'Stay fit', icon: 'heart.fill' },
];
const LEVELS: { value: Experience; label: string; detail: string }[] = [
  { value: 'beginner', label: 'New', detail: 'Under a year of regular training' },
  { value: 'intermediate', label: 'Regular', detail: '1–3 years, comfortable with main lifts' },
  { value: 'advanced', label: 'Experienced', detail: '3+ years, structured programs' },
];
const EQUIPMENT: { value: Equipment; label: string }[] = [
  { value: 'barbell', label: 'Barbell' }, { value: 'dumbbell', label: 'Dumbbells' }, { value: 'kettlebell', label: 'Kettlebells' },
  { value: 'cable', label: 'Cables' }, { value: 'machine', label: 'Machines' }, { value: 'band', label: 'Bands' }, { value: 'bodyweight', label: 'Bodyweight' },
];

export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const store = useStore();
  const [step, setStep] = useState(0);
  const [p, setP] = useState(store.profile);
  const [weight, setWeight] = useState(75);
  const [skipBody, setSkipBody] = useState(false);
  const up = (patch: Partial<typeof p>) => setP((x) => ({ ...x, ...patch }));

  const steps = [
    <View key="name" style={styles.step}>
      <T v="big">Welcome to Beyond</T>
      <T color={colors.dim}>What should we call you?</T>
      <TextInput value={p.name} onChangeText={(name) => up({ name })} placeholder="Your name" placeholderTextColor={colors.faint} style={styles.input} autoFocus returnKeyType="next" onSubmitEditing={() => setStep(1)} />
      <Segmented options={[{ value: 'kg', label: 'Kilograms' }, { value: 'lb', label: 'Pounds' }]} value={p.unit} onChange={(unit) => up({ unit: unit as Unit })} />
    </View>,
    <View key="goal" style={styles.step}>
      <T v="big">Your goal</T>
      <View style={styles.grid}>
        {GOALS.map((g) => (
          <Press key={g.value} onPress={() => up({ goal: g.value })} style={[styles.tile, p.goal === g.value && styles.tileOn]}>
            <Icon name={g.icon} size={24} color={p.goal === g.value ? colors.cyan : colors.dim} />
            <T v="headline" color={p.goal === g.value ? colors.text : colors.dim}>{g.label}</T>
          </Press>
        ))}
      </View>
    </View>,
    <View key="level" style={styles.step}>
      <T v="big">Experience</T>
      {LEVELS.map((l) => (
        <Press key={l.value} onPress={() => up({ experience: l.value })} style={[styles.option, p.experience === l.value && styles.tileOn]}>
          <View style={{ flex: 1, gap: 2 }}>
            <T v="headline">{l.label}</T>
            <T v="label" color={colors.dim}>{l.detail}</T>
          </View>
          {p.experience === l.value && <Icon name="checkmark.circle.fill" color={colors.cyan} size={22} />}
        </Press>
      ))}
    </View>,
    <View key="week" style={styles.step}>
      <T v="big">Your week</T>
      <View style={styles.panel}>
        <Stepper label="Days per week" value={p.days} onChange={(days) => up({ days })} min={1} max={7} big />
      </View>
      <View style={styles.panel}>
        <Stepper label="Minutes per session" value={p.minutes} onChange={(minutes) => up({ minutes })} step={5} min={20} max={150} big />
      </View>
    </View>,
    <View key="gear" style={styles.step}>
      <T v="big">Equipment</T>
      <T color={colors.dim}>Only what you can use. Programs and swaps follow this.</T>
      <Row style={{ flexWrap: 'wrap' }} gap={space.sm}>
        {EQUIPMENT.map((e) => {
          const on = p.equipment.includes(e.value);
          return <Chip key={e.value} label={e.label} active={on} onPress={() => up({ equipment: on ? p.equipment.filter((x) => x !== e.value) : [...p.equipment, e.value] })} />;
        })}
      </Row>
      <Row gap={space.sm}>
        <Button small kind="secondary" title="Full gym" onPress={() => up({ equipment: EQUIPMENT.map((e) => e.value) })} />
        <Button small kind="secondary" title="Home" onPress={() => up({ equipment: ['bodyweight', 'dumbbell', 'band'] })} />
      </Row>
    </View>,
    <View key="body" style={styles.step}>
      <T v="big">About you</T>
      <T color={colors.dim}>Optional. Used only to estimate a starting calorie target.</T>
      <Segmented options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} value={p.sex ?? 'male'} onChange={(sex) => up({ sex: sex as 'male' | 'female' })} />
      <View style={styles.panel}>
        <Row>
          <Stepper label="Born" value={p.birthYear ?? 1995} onChange={(birthYear) => up({ birthYear })} min={1930} max={2015} />
          <Stepper label="Height cm" value={p.heightCm ?? 175} onChange={(heightCm) => up({ heightCm })} min={120} max={230} />
        </Row>
      </View>
      <View style={styles.panel}>
        <Stepper label={`Weight ${p.unit}`} value={weight} onChange={setWeight} step={0.5} min={30} max={400} big format={(v) => v.toFixed(1)} />
      </View>
      <Press onPress={() => setSkipBody(!skipBody)} haptic={false}>
        <Row gap={6} style={{ justifyContent: 'center' }}>
          {skipBody && <Icon name="checkmark" size={13} color={colors.cyan} />}
          <T v="label" color={skipBody ? colors.cyan : colors.dim}>Skip, I’ll set my targets myself</T>
        </Row>
      </Press>
    </View>,
  ];

  const finish = () => {
    const kg = p.unit === 'lb' ? weight / 2.2046226218 : weight;
    const profile = { ...p, sex: skipBody ? null : p.sex ?? 'male', birthYear: skipBody ? null : p.birthYear ?? 1995, heightCm: skipBody ? null : p.heightCm ?? 175, onboarded: true };
    store.setProfile(profile);
    if (!skipBody) {
      store.saveBody({ id: uid(), date: today(), weightKg: kg, waistCm: null, chestCm: null, armCm: null, thighCm: null, photo: null });
      const t = startingTargets(profile, kg);
      if (t) store.set({ targets: t });
    }
    if (!useStore.getState().programs.length) useStore.getState().generate();
    router.replace('/(tabs)/today');
  };

  const last = step === steps.length - 1;
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.black, paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.lg, paddingHorizontal: space.xl }}>
      <Row gap={6}>
        {steps.map((_, i) => <View key={i} style={[styles.dot, { backgroundColor: i <= step ? colors.cyan : colors.surface3, flex: i === step ? 2.5 : 1, transitionProperty: ['flex', 'backgroundColor'], transitionDuration: 250 } as any]} />)}
      </Row>
      <Animated.View key={step} entering={reduced ? undefined : FadeIn.duration(220)} exiting={reduced ? undefined : FadeOut.duration(120)} style={{ flex: 1, justifyContent: 'center' }}>
        {steps[step]}
      </Animated.View>
      <Row>
        {step > 0 && <Button kind="secondary" icon="chevron.left" onPress={() => setStep(step - 1)} />}
        <Button style={{ flex: 1 }} title={last ? 'Build my program' : 'Continue'} kind={last ? 'lime' : 'primary'} onPress={() => (last ? finish() : setStep(step + 1))} />
      </Row>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  step: { gap: space.lg },
  input: { height: 56, borderRadius: radius.md, backgroundColor: colors.surface2, color: colors.text, fontSize: 20, paddingHorizontal: space.lg, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { width: '48.5%' as any, aspectRatio: 1.35, borderRadius: radius.lg, backgroundColor: colors.surface, padding: space.lg, justifyContent: 'space-between', borderWidth: 1, borderColor: colors.hairline },
  tileOn: { borderColor: alpha(colors.cyan, 0.6), backgroundColor: alpha(colors.cyan, 0.08) },
  option: { flexDirection: 'row', alignItems: 'center', padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline },
  panel: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg },
  dot: { height: 4, borderRadius: 2 },
});

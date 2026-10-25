import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Icon } from '../src/components/Icon';
import { Button, Card, Chip, Divider, Row, Stepper, T, Toggle } from '../src/components/ui';
import { lookupProduct } from '../src/domain/nutrition';
import { doseMicros, doseNutrients, formatDose, supplementFromOff, UNITS } from '../src/domain/supplements';
import type { DoseUnit, Supplement } from '../src/domain/types';
import { uid, useStore } from '../src/store';
import { colors, radius, space, type } from '../src/theme';

const STEP: Record<DoseUnit, number> = { g: 0.5, mg: 50, ml: 1, capsule: 1, tablet: 1, scoop: 0.5, drop: 1 };
const pad = (n: number) => String(n).padStart(2, '0');

/** Set up a daily intake: from a scanned barcode (code), by name (nothing), or edit one (id). */
export default function IntakeSetup() {
  const { code, id } = useLocalSearchParams<{ code?: string; id?: string }>();
  const router = useRouter();
  const s = useStore();
  const existing = id ? s.supplements.find((x) => x.id === id) : undefined;
  const [x, setX] = useState<Supplement>(() => existing ?? {
    id: uid(), name: '', brand: null, image: null, barcode: code ?? null, dose: 1, unit: 'capsule', time: '08:00',
    per100: null, servingG: null, micros: [], createdAt: new Date().toISOString(),
  });
  const [state, setState] = useState<'idle' | 'looking' | 'missing' | 'offline'>(code && !existing ? 'looking' : 'idle');
  const [label, setLabel] = useState<string | null>(null);
  const up = (patch: Partial<Supplement>) => setX((v) => ({ ...v, ...patch }));

  const look = async () => {
    if (!code) return;
    setState('looking');
    const r = await lookupProduct(code);
    if (r.status !== 'found') return setState(r.status);
    const p = supplementFromOff(r.product);
    if (!p) return setState('missing');
    // Powders default to grams, everything else to one unit a day.
    const powder = !!p.per100 && (p.servingG ?? 0) >= 2;
    setX((v) => ({ ...v, ...p, barcode: code, unit: powder ? 'g' : v.unit, dose: powder ? p.servingG! : v.dose }));
    setLabel(p.servingLabel);
    setState('idle');
  };
  useEffect(() => { look(); }, [code]);

  const [h, m] = (x.time ?? '08:00').split(':').map(Number);
  const nutrients = doseNutrients(x);
  const micros = doseMicros(x);
  const save = () => {
    s.saveSupplement({ ...x, name: x.name.trim() });
    router.back();
  };
  const remove = () => {
    const go = () => { s.deleteSupplement(x.id); router.back(); };
    if (Platform.OS === 'web') return go();
    Alert.alert(`Remove ${x.name}?`, 'Its reminders stop. Days you already ticked stay in your history.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: go },
    ]);
  };

  if (state === 'looking') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
        <ActivityIndicator color={colors.cyan} />
        <T v="label" color={colors.dim}>Looking up {code}…</T>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.lg }} keyboardShouldPersistTaps="handled">
      <T v="title">{existing ? 'Daily intake' : 'Add daily intake'}</T>
      {state !== 'idle' && (
        <Animated.View entering={FadeIn.duration(200)}>
          <Card style={{ borderColor: colors.amber }}>
            <T v="headline">{state === 'offline' ? 'No connection' : 'Not in the database'}</T>
            <T v="label" color={colors.dim}>{state === 'offline' ? 'Name it below, or try again with a connection.' : `Nothing found for ${code}. Name it below; it is set up the same way.`}</T>
            {state === 'offline' && <Button kind="secondary" title="Try again" onPress={look} />}
          </Card>
        </Animated.View>
      )}

      <Row style={{ alignItems: 'center' }}>
        <View style={[styles.thumb, !!x.image && { backgroundColor: '#F3F5F9' }]}>
          {x.image ? <Image source={x.image} style={{ flex: 1 }} contentFit="contain" cachePolicy="disk" /> : <Icon name="pills.fill" size={24} color={colors.cyan} />}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <TextInput value={x.name} onChangeText={(name) => up({ name })} placeholder="Creatine, multivitamin…" placeholderTextColor={colors.faint} style={styles.name} />
          {!!x.brand && <T v="footnote" color={colors.dim}>{x.brand}</T>}
        </View>
      </Row>

      <View style={{ gap: space.sm }}>
        <T v="caption" color={colors.faint}>Daily dose</T>
        <Row><Stepper value={x.dose} onChange={(dose) => up({ dose })} step={STEP[x.unit]} min={STEP[x.unit]} max={x.unit === 'mg' ? 20000 : 500} format={() => formatDose(x)} big /></Row>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {UNITS.map((u) => <Chip key={u} label={u} active={x.unit === u} onPress={() => up({ unit: u, dose: u === x.unit ? x.dose : u === 'g' ? 5 : u === 'mg' ? 500 : u === 'ml' ? 5 : 1 })} />)}
        </ScrollView>
        {!!label && <T v="footnote" color={colors.faint}>Label serving: {label}</T>}
      </View>

      <Divider />
      <Row style={{ justifyContent: 'space-between' }}>
        <View>
          <T v="headline">Remind me every day</T>
          <T v="footnote" color={colors.dim}>Skipped once you tick it</T>
        </View>
        <Toggle value={x.time !== null} onChange={(on) => up({ time: on ? '08:00' : null })} />
      </Row>
      {x.time !== null && (
        <Animated.View entering={FadeIn.duration(180)} style={{ gap: space.sm }}>
          <T v="hero" style={[type.num, { textAlign: 'center', fontSize: 56, lineHeight: 64 }]}>{pad(h)}:{pad(m)}</T>
          <Row>
            <Stepper label="Hour" value={h} onChange={(v) => up({ time: `${pad(v)}:${pad(m)}` })} min={0} max={23} format={pad} />
            <Stepper label="Minute" value={m} onChange={(v) => up({ time: `${pad(h)}:${pad(v)}` })} step={5} min={0} max={55} format={pad} />
          </Row>
        </Animated.View>
      )}

      {(micros.length > 0 || (nutrients && (nutrients.kcal > 0 || nutrients.protein > 0))) && (
        <>
          <Divider />
          <View style={{ gap: space.sm }}>
            <T v="caption" color={colors.faint}>In each dose</T>
            <Card style={{ gap: 0, paddingVertical: space.sm }}>
              {nutrients && (nutrients.kcal > 0 || nutrients.protein > 0) && (
                <Row style={styles.line}><T v="callout">Energy · protein</T><T v="callout" color={colors.dim} style={type.num}>{nutrients.kcal} kcal · {nutrients.protein} g</T></Row>
              )}
              {micros.map((v) => (
                <Row key={v.label} style={styles.line}><T v="callout">{v.label}</T><T v="callout" color={colors.dim} style={type.num}>{v.amount} {v.unit}</T></Row>
              ))}
            </Card>
            {nutrients && nutrients.kcal > 0 && <T v="footnote" color={colors.faint}>Counted in the day's food once ticked.</T>}
          </View>
        </>
      )}

      <Button kind="lime" icon="checkmark" title={existing ? 'Save' : 'Add to daily intake'} disabled={!x.name.trim()} onPress={save} />
      {existing && <Button kind="ghost" title="Remove" onPress={remove} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  thumb: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.surface2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  name: { color: colors.text, fontSize: 22, fontWeight: '700', paddingVertical: 4 },
  line: { justifyContent: 'space-between', paddingVertical: 8 },
});

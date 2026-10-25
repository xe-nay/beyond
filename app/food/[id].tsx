import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Icon } from '../../src/components/Icon';
import { MacroDonut, MacroLegend, NutriScore } from '../../src/components/Nutrition';
import { Button, Chip, Divider, Press, Row, Segmented, Stepper, T, tap } from '../../src/components/ui';
import { scale } from '../../src/domain/nutrition';
import type { Meal } from '../../src/domain/types';
import { dayLabel, MEALS, mealNow } from '../../src/meals';
import { clock, isPlanned, today, useStore } from '../../src/store';
import { alpha, colors, radius, space, type } from '../../src/theme';

export default function FoodSheet() {
  const params = useLocalSearchParams<{ id: string; entry?: string; date?: string; meal?: string }>();
  const router = useRouter();
  const s = useStore();
  const food = s.foods[params.id];
  const entry = params.entry ? s.entries.find((e) => e.id === params.entry) : undefined;
  const serving = food?.servingSize && food.servingSize > 0 ? food.servingSize : null;

  const [mode, setMode] = useState<'serving' | 'amount'>(entry ? 'amount' : serving ? 'serving' : 'amount');
  const [servings, setServings] = useState(entry && serving ? entry.amount / serving : 1);
  const [grams, setGrams] = useState(entry?.amount ?? serving ?? 100);
  const [meal, setMeal] = useState<Meal>((entry?.meal ?? (params.meal as Meal)) || mealNow());
  const [mealPicked, setMealPicked] = useState(!!entry || !!params.meal);
  const [date, setDate] = useState(entry?.date ?? (params.date || today()));
  const [time, setTime] = useState(entry?.time ?? clock());
  const [when, setWhen] = useState(false);
  const [h, m] = time.split(':').map(Number);
  const pad = (v: number) => String(v).padStart(2, '0');
  // The meal follows the time until one is picked by hand.
  const setClock = (hh: number, mm: number) => {
    setTime(`${pad(hh)}:${pad(mm)}`);
    if (!mealPicked) setMeal(hh < 11 ? 'breakfast' : hh < 15 ? 'lunch' : hh < 18 ? 'snack' : 'dinner');
  };
  const shiftDay = (d: number) => {
    const x = new Date(`${date}T12:00:00`);
    x.setDate(x.getDate() + d);
    setDate(today(x));
  };
  const planned = isPlanned({ date, time });
  const amount = mode === 'serving' && serving ? servings * serving : grams;
  const shown = String(Math.round((mode === 'serving' ? servings : grams) * 100) / 100);
  const digitSize = shown.length <= 3 ? 64 : shown.length === 4 ? 52 : 42;
  const n = useMemo(() => (food ? scale(food.per100, amount) : null), [food, amount]);
  if (!food || !n) return null;
  const unit = food.basis;

  const save = () => {
    if (entry) s.deleteEntry(entry.id);
    s.logFood(food, Math.round(amount * 10) / 10, meal, date, n, time);
    router.back();
  };

  const rows: [string, number | null | undefined, string, boolean?][] = [
    ['Energy', n.kcal, 'kcal'], ['Fat', n.fat, 'g'], ['Saturated', n.satFat, 'g', true], ['Carbohydrates', n.carbs, 'g'],
    ['Sugars', n.sugar, 'g', true], ['Fibre', n.fiber, 'g'], ['Protein', n.protein, 'g'], ['Salt', n.salt, 'g'],
  ];

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: space.xxl }} keyboardShouldPersistTaps="handled">
      {/* Product */}
      <View style={[styles.hero, !food.image && { backgroundColor: colors.surface2 }]}>
        {food.image ? <Image source={food.image} style={StyleSheet.absoluteFill} contentFit="contain" cachePolicy="disk" transition={200} /> : <Icon name="fork.knife" size={40} color={colors.dim} />}
        <Press onPress={() => s.toggleFavorite(food.id)} style={styles.fav}>
          <Icon name={food.favorite ? 'star.fill' : 'star'} size={18} color={food.favorite ? colors.amber : '#1B2233'} />
        </Press>
      </View>
      <View style={{ padding: space.xl, gap: space.lg }}>
        <View style={{ gap: 4 }}>
          {food.brand && <T v="caption" color={colors.cyan}>{food.brand}</T>}
          <T v="title">{food.name}</T>
          <Row gap={space.md} style={{ marginTop: 6 }}>
            <NutriScore grade={food.nutriScore} />
            {food.nova && <T v="label" color={colors.dim}>NOVA {food.nova}</T>}
            <T v="label" color={colors.faint}>{food.per100.kcal} kcal / 100 {unit}</T>
          </Row>
        </View>

        <Row gap={space.xl}>
          <MacroDonut n={n} size={128} />
          <MacroLegend n={n} />
        </Row>

        {/* Amount */}
        <View style={styles.panel}>
          {serving && (
            <Segmented options={[{ value: 'serving', label: food.servingLabel ? `Serving · ${food.servingLabel}` : `Serving · ${serving} ${unit}` }, { value: 'amount', label: unit === 'ml' ? 'Millilitres' : 'Grams' }]}
              value={mode} onChange={(m) => setMode(m as 'serving' | 'amount')} />
          )}
          <Row style={{ justifyContent: 'space-between' }}>
            <Press onPress={() => (mode === 'serving' ? setServings(Math.max(0.25, servings - 0.5)) : setGrams(Math.max(1, grams - 10)))} style={styles.step}><Icon name="minus" size={18} /></Press>
            <Row gap={6} style={{ alignItems: 'baseline' }}>
              <TextInput
                value={shown}
                onChangeText={(t) => { const v = parseFloat(t.replace(',', '.')); if (Number.isFinite(v)) (mode === 'serving' ? setServings(v) : setGrams(v)); }}
                keyboardType="decimal-pad" selectTextOnFocus
                // Sized to its digits: a fixed width cut "230" down to "23" once the keyboard closed.
                style={[type.hero as any, { color: colors.text, fontSize: digitSize, lineHeight: digitSize * 1.15, width: shown.length * digitSize * 0.64 + 16, textAlign: 'center', padding: 0 }]}
              />
              <T v="headline" color={colors.dim}>{mode === 'serving' ? (servings === 1 ? 'serving' : 'servings') : unit}</T>
            </Row>
            <Press onPress={() => (mode === 'serving' ? setServings(servings + 0.5) : setGrams(grams + 10))} style={styles.step}><Icon name="plus" size={18} /></Press>
          </Row>
          <Row gap={space.sm} style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
            {(mode === 'serving' ? [0.5, 1, 1.5, 2, 3] : [30, 50, 100, 150, 250]).map((v) => (
              <Chip key={v} label={mode === 'serving' ? `${v}×` : `${v} ${unit}`} active={(mode === 'serving' ? servings : grams) === v} onPress={() => (mode === 'serving' ? setServings(v) : setGrams(v))} />
            ))}
          </Row>
          {mode === 'serving' && <T v="label" color={colors.faint} style={{ textAlign: 'center' }}>{Math.round(amount)} {unit}</T>}
        </View>

        <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
          {MEALS.map((x) => <Chip key={x.value} label={x.label} active={meal === x.value} onPress={() => { tap(); setMeal(x.value); setMealPicked(true); }} />)}
        </Row>

        {/* When it was eaten, or when it is planned */}
        <View style={styles.panel}>
          <Press onPress={() => setWhen(!when)} haptic={false}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Row gap={space.sm}>
                <Icon name="clock" size={16} color={planned ? colors.amber : colors.cyan} />
                <T v="headline">{dayLabel(date)} · {time}</T>
              </Row>
              <T v="footnote" color={planned ? colors.amber : colors.faint}>{planned ? 'Planned meal' : 'Eaten'}</T>
            </Row>
          </Press>
          {when && (
            <View style={{ gap: space.md }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Press onPress={() => shiftDay(-1)} style={styles.step}><Icon name="chevron.left" size={16} /></Press>
                <T v="headline">{new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}</T>
                <Press onPress={() => shiftDay(1)} style={styles.step}><Icon name="chevron.right" size={16} /></Press>
              </Row>
              <Row>
                <Stepper label="Hour" value={h} onChange={(v) => setClock(v, m)} min={0} max={23} format={pad} />
                <Stepper label="Minute" value={m} onChange={(v) => setClock(h, v)} step={5} min={0} max={55} format={pad} />
              </Row>
              <Chip label="Now" onPress={() => { const d = new Date(); setDate(today(d)); setClock(d.getHours(), d.getMinutes()); }} />
              {planned && <T v="footnote" color={colors.dim}>Counted once its time comes; you get a reminder then.</T>}
            </View>
          )}
        </View>

        <Button kind="lime" icon={entry ? 'checkmark' : planned ? 'clock' : 'plus'} title={entry ? 'Update' : planned ? `Plan ${n.kcal} kcal` : `Add ${n.kcal} kcal`} onPress={save} />
        {entry && <Button kind="danger" icon="trash" title="Remove from diary" onPress={() => { s.deleteEntry(entry.id); router.back(); }} />}

        {/* Facts */}
        <View style={styles.panel}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="headline">Nutrition facts</T>
            <T v="label" color={colors.faint}>{Math.round(amount)} {unit}</T>
          </Row>
          <Divider />
          {rows.map(([k, v, u, sub]) => (
            <Row key={k} style={{ justifyContent: 'space-between', paddingLeft: sub ? space.md : 0 }}>
              <T v={sub ? 'label' : 'body'} color={sub ? colors.dim : colors.text}>{k}</T>
              <T v={sub ? 'label' : 'body'} color={sub ? colors.dim : colors.text} style={type.num}>{v === null || v === undefined ? '—' : `${v} ${u}`}</T>
            </Row>
          ))}
        </View>
        <T v="caption" color={colors.faint} style={{ textAlign: 'center', textTransform: 'none' }}>
          {food.barcode ? `${food.barcode} · ` : ''}Open Food Facts, community data. Check the label if something looks off.
        </T>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { height: 220, backgroundColor: '#F3F5F9', alignItems: 'center', justifyContent: 'center', borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: 'hidden' },
  fav: { position: 'absolute', top: 18, right: 18, width: 38, height: 38, borderRadius: 19, backgroundColor: alpha('#FFFFFF', 0.85), alignItems: 'center', justifyContent: 'center' },
  panel: { backgroundColor: colors.surface2, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  step: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface3, alignItems: 'center', justifyContent: 'center' },
});

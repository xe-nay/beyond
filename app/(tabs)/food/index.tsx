import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeIn, LinearTransition, useReducedMotion } from 'react-native-reanimated';

import { DailyIntake } from '../../../src/components/DailyIntake';
import { Icon } from '../../../src/components/Icon';
import { MacroDonut, MacroLegend } from '../../../src/components/Nutrition';
import { Card, Press, Row, Screen, Section, T } from '../../../src/components/ui';
import type { FoodEntry } from '../../../src/domain/types';
import { MEALS } from '../../../src/meals';
import { eatenOn, today, useStore } from '../../../src/store';
import { alpha, colors, radius, space, type } from '../../../src/theme';

export default function Food() {
  const router = useRouter();
  const reduced = useReducedMotion();
  const s = useStore();
  const [offset, setOffset] = useState(0);
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const date = today(d);
  const entries = s.entries.filter((e) => e.date === date);
  const total = eatenOn(s, date);
  const left = s.targets.kcal - total.kcal;
  const recent = Object.values(s.foods).sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.lastUsed.localeCompare(a.lastUsed)).slice(0, 12);

  return (
    <Screen>
      {/* Day switcher */}
      <Row style={{ justifyContent: 'space-between', marginTop: -space.sm }}>
        <Press onPress={() => setOffset(offset - 1)} hitSlop={10}><Icon name="chevron.left" size={16} color={colors.dim} /></Press>
        <T v="headline">{offset === 0 ? 'Today' : offset === -1 ? 'Yesterday' : d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</T>
        <Press onPress={() => setOffset(Math.min(0, offset + 1))} hitSlop={10} disabled={offset === 0}><Icon name="chevron.right" size={16} color={colors.dim} /></Press>
      </Row>

      <DailyIntake date={date} />

      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.xl }} onPress={() => router.push('/targets')}>
        <MacroDonut n={total} size={136} label={`of ${s.targets.kcal}`} />
        <View style={{ flex: 1, gap: space.md }}>
          <View>
            <T v="caption" color={colors.faint}>{left >= 0 ? 'Remaining' : 'Over'}</T>
            <T v="title" color={left >= 0 ? colors.lime : colors.amber} style={type.num}>{Math.abs(left)} kcal</T>
          </View>
          <MacroLegend n={total} targets={s.targets} />
        </View>
      </Card>

      {/* The one action: scan */}
      <Press onPress={() => router.push({ pathname: '/scan', params: { date } })} style={{ height: 76, borderRadius: radius.xl, backgroundColor: colors.cyan, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.md }}>
        <Icon name="barcode.viewfinder" size={28} color={colors.black} />
        <T v="title" color={colors.black}>Scan food</T>
      </Press>

      {recent.length > 0 && (
        <Section title="Quick add">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }} style={{ marginHorizontal: -space.lg }}>
            <View style={{ width: space.sm }} />
            {recent.map((f) => (
              <Press key={f.id} onPress={() => router.push({ pathname: '/food/[id]', params: { id: f.id, date } })} style={{ width: 104, gap: 6 }}>
                <View style={{ width: 104, height: 104, borderRadius: radius.md, backgroundColor: '#F3F5F9', overflow: 'hidden' }}>
                  {f.image && <Image source={f.image} style={{ flex: 1 }} contentFit="contain" cachePolicy="disk" />}
                  {f.favorite && <View style={{ position: 'absolute', top: 6, right: 6 }}><Icon name="star.fill" size={12} color={colors.amber} /></View>}
                </View>
                <T v="label" numberOfLines={2}>{f.name}</T>
              </Press>
            ))}
            <View style={{ width: space.sm }} />
          </ScrollView>
        </Section>
      )}

      {MEALS.map((m) => {
        const list = entries.filter((e) => e.meal === m.value);
        const kcal = list.reduce((n, e) => n + e.nutrients.kcal, 0);
        return (
          <Section key={m.value} title={m.label} action={<T v="label" color={colors.dim} style={type.num}>{kcal ? `${kcal} kcal` : ''}</T>}>
            <Card style={{ padding: list.length ? space.sm : space.md, gap: 0 }}>
              {list.map((e) => (
                <Animated.View key={e.id} entering={reduced ? undefined : FadeIn.duration(200)} layout={reduced ? undefined : LinearTransition.duration(200)}>
                  <EntryRow e={e} onPress={() => router.push({ pathname: '/food/[id]', params: { id: e.foodId, entry: e.id } })} />
                </Animated.View>
              ))}
              {!list.length && (
                <Press onPress={() => router.push({ pathname: '/scan', params: { date, meal: m.value } })} haptic={false}>
                  <Row gap={space.sm}><Icon name="plus" size={13} color={colors.faint} /><T v="label" color={colors.faint}>Scan to add</T></Row>
                </Press>
              )}
            </Card>
          </Section>
        );
      })}
      <T v="caption" color={colors.faint} style={{ textAlign: 'center', textTransform: 'none' }}>Food data from Open Food Facts (ODbL)</T>
    </Screen>
  );
}

function EntryRow({ e, onPress }: { e: FoodEntry; onPress: () => void }) {
  return (
    <Press onPress={onPress} haptic={false}>
      <Row style={{ padding: space.sm }}>
        <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: '#F3F5F9', overflow: 'hidden' }}>
          {e.image ? <Image source={e.image} style={{ flex: 1 }} contentFit="contain" cachePolicy="disk" /> : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(colors.cyan, 0.15) }}><Icon name="fork.knife" size={16} color={colors.cyan} /></View>}
        </View>
        <View style={{ flex: 1 }}>
          <T v="headline" numberOfLines={1}>{e.name}</T>
          <T v="label" color={colors.dim} numberOfLines={1}>{[e.brand, `${Math.round(e.amount)} ${e.basis}`].filter(Boolean).join(' · ')}</T>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <T v="headline" style={type.num}>{e.nutrients.kcal}</T>
          <T v="caption" color={colors.faint}>kcal</T>
        </View>
      </Row>
    </Press>
  );
}

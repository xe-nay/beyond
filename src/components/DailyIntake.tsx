// The daily intake checklist: each supplement with its dose and reminder time, ticked once taken.
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Alert, Platform, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { daysLeft, doseMicros, formatAmount, formatDose, LOW_DAYS, stockLeft } from '../domain/supplements';
import type { Supplement } from '../domain/types';
import { today, useStore } from '../store';
import { alpha, colors, radius, space, type } from '../theme';
import { Icon } from './Icon';
import { Card, Press, Row, T } from './ui';

export function DailyIntake({ date }: { date: string }) {
  const router = useRouter();
  const s = useStore();
  // Supplements that existed that day, plus ticks of ones removed since.
  const list = s.supplements.filter((x) => x.createdAt.slice(0, 10) <= date).sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99'));
  const gone = s.intakes.filter((i) => i.date === date && !s.supplements.some((x) => x.id === i.supplementId));
  const taken = (id: string) => s.intakes.some((i) => i.supplementId === id && i.date === date);
  const done = list.filter((x) => taken(x.id)).length + gone.length;

  const add = (
    <Press onPress={() => router.push({ pathname: '/scan', params: { mode: 'intake' } })} hitSlop={8}>
      <Row gap={4}><Icon name="plus" size={13} color={colors.cyan} /><T v="footnote" color={colors.cyan}>Add</T></Row>
    </Press>
  );

  if (!list.length && !gone.length) {
    // Setting one up belongs to today, not to a day looked back on.
    if (date < today()) return null;
    return (
      <Press onPress={() => router.push({ pathname: '/scan', params: { mode: 'intake' } })} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline, borderStyle: 'dashed' }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(colors.cyan, 0.14) }}>
          <Icon name="pills.fill" size={16} color={colors.cyan} />
        </View>
        <View style={{ flex: 1 }}>
          <T v="headline">Add daily intake</T>
          <T v="footnote" color={colors.dim}>Creatine, vitamins… scan it, get a daily reminder</T>
        </View>
        <Icon name="chevron.right" size={14} color={colors.faint} />
      </Press>
    );
  }

  const tick = (id: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(taken(id) ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    s.toggleIntake(id, date);
  };

  return (
    <View style={{ gap: space.sm }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row gap={6}>
          <T v="caption" color={colors.faint}>Daily intake</T>
          <T v="caption" color={done === list.length + gone.length ? colors.lime : colors.faint} style={type.num}>{done}/{list.length + gone.length}</T>
        </Row>
        {add}
      </Row>
      <Card style={{ padding: space.sm, gap: 0 }}>
        {list.map((x) => {
          const on = taken(x.id);
          return (
            <Row key={x.id} style={{ padding: space.sm }}>
              <Press onPress={() => router.push({ pathname: '/intake', params: { id: x.id } })} haptic={false} style={{ flex: 1 }}>
                <Row>
                  <View style={{ width: 40, height: 40, borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: x.image ? '#F3F5F9' : alpha(colors.cyan, 0.12) }}>
                    {x.image ? <Image source={x.image} style={{ width: 40, height: 40 }} contentFit="contain" cachePolicy="disk" /> : <Icon name="pills.fill" size={16} color={colors.cyan} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <T v="headline" numberOfLines={1} color={on ? colors.dim : colors.text}>{x.name}</T>
                    <T v="footnote" color={colors.faint}>{formatDose(x)}{x.time ? ` · ${x.time}` : ''}{!on && s.skipped.some((k) => k.supplementId === x.id && k.date === date) ? ' · skipped' : ''}</T>
                    {/* What it adds to the day's nutrition, or a nudge when it adds nothing yet */}
                    <T v="footnote" color={doseMicros(x).length ? colors.cyan : colors.amber} numberOfLines={1}>
                      {doseMicros(x).length ? doseMicros(x).slice(0, 3).map((v) => `${v.label} ${v.amount} ${v.unit}`).join(' · ') : 'No label values · tap to add'}
                    </T>
                  </View>
                </Row>
              </Press>
              {x.stock && <Left x={x} />}
              <Press onPress={() => tick(x.id)} haptic={false} hitSlop={10}>
                <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: on ? 0 : 2, borderColor: colors.hairlineStrong, backgroundColor: on ? colors.lime : 'transparent' }}>
                  {on && <Animated.View entering={ZoomIn.springify().dampingRatio(0.55)}><Icon name="checkmark" size={14} color={colors.black} /></Animated.View>}
                </View>
              </Press>
            </Row>
          );
        })}
        {gone.map((i) => (
          <Animated.View key={i.id} entering={FadeIn}>
            <Row style={{ padding: space.sm }}>
              <View style={{ flex: 1 }}>
                <T v="headline" color={colors.dim}>{i.name}</T>
                <T v="footnote" color={colors.faint}>{i.dose} · removed since</T>
              </View>
              <Icon name="checkmark.circle.fill" size={28} color={colors.lime} />
            </Row>
          </Animated.View>
        ))}
      </Card>
    </View>
  );
}

/** What is left in the pack; tap to correct it (counted from now on). */
function Left({ x }: { x: Supplement }) {
  const router = useRouter();
  const intakes = useStore((s) => s.intakes);
  const left = stockLeft(x, intakes) ?? 0;
  const days = daysLeft(x, intakes);
  const low = days !== null && days <= LOW_DAYS;
  const edit = () => {
    const st = x.stock!;
    if (Platform.OS !== 'ios') return router.push({ pathname: '/intake', params: { id: x.id } });
    Alert.prompt(`${x.name}: left now`, `In ${st.unit === 'g' || st.unit === 'ml' ? st.unit : `${st.unit}s`}. A full pack holds ${formatAmount(st.total, st.unit)}.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'New pack', onPress: () => useStore.getState().saveSupplement({ ...x, stock: { ...st, left: st.total, at: new Date().toISOString(), warned: undefined } }) },
      { text: 'Save', onPress: (v?: string) => {
        const n = parseFloat((v ?? '').replace(',', '.'));
        if (Number.isFinite(n) && n >= 0) useStore.getState().saveSupplement({ ...x, stock: { ...st, left: n, at: new Date().toISOString(), warned: undefined } });
      } },
    ], 'plain-text', String(left), 'decimal-pad');
  };
  return (
    <Press onPress={edit} haptic={false} hitSlop={6} style={{ alignItems: 'flex-end', marginRight: space.md }}>
      <T v="headline" color={low ? colors.amber : colors.text} style={type.num}>{+left.toFixed(1)}</T>
      <T v="caption" color={low ? colors.amber : colors.faint}>{days !== null ? `${days} ${days === 1 ? 'day' : 'days'}` : 'left'}</T>
    </Press>
  );
}

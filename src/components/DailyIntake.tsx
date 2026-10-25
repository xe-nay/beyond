// The daily intake checklist: each supplement with its dose and reminder time, ticked once taken.
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Platform, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { formatDose } from '../domain/supplements';
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
                    <T v="footnote" color={colors.faint}>{formatDose(x)}{x.time ? ` · ${x.time}` : ''}</T>
                  </View>
                </Row>
              </Press>
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

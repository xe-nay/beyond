import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeIn, LinearTransition, useReducedMotion } from 'react-native-reanimated';

import { Icon } from '../src/components/Icon';
import { Button, Card, Press, Row, T } from '../src/components/ui';
import { daysLeft, dueNow, formatAmount, formatDose, LOW_DAYS, stockLeft } from '../src/domain/supplements';
import { answerSlot } from '../src/intakeActions';
import { clock, today, useStore } from '../src/store';
import { alpha, colors, space, type } from '../src/theme';

/** Intake reminders still to answer today, packs running low, and the buy reminders given so far. */
export default function Inbox() {
  const router = useRouter();
  const reduced = useReducedMotion();
  const s = useStore();
  const date = today();
  const now = clock();
  const due = dueNow(s.supplements, s.intakes, s.skipped, date, now);
  const low = s.supplements.filter((x) => { const d = daysLeft(x, s.intakes); return d !== null && d <= LOW_DAYS; });

  // Opening the panel reads what is in it.
  useEffect(() => {
    if (s.inbox.some((i) => !i.read)) s.set({ inbox: s.inbox.map((i) => ({ ...i, read: true })) });
  }, []);

  const layout = reduced ? undefined : LinearTransition.duration(200);
  return (
    <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.lg, paddingBottom: 80 }}>
      <T v="title">Notifications</T>

      {due.map(({ time, list }) => (
        <Animated.View key={time} layout={layout} entering={reduced ? undefined : FadeIn.duration(180)}>
          <Card style={{ borderColor: alpha(colors.cyan, 0.4) }}>
            <Row>
              <Icon name="pills.fill" size={18} color={colors.cyan} />
              <View style={{ flex: 1 }}>
                <T v="caption" color={colors.cyan}>To take · {time}</T>
                {list.map((x) => <T key={x.id} v="headline">{x.name} <T v="footnote" color={colors.dim}>{formatDose(x)}</T></T>)}
              </View>
            </Row>
            <Row gap={space.sm}>
              <Button kind="secondary" title="Skip" onPress={() => answerSlot(date, time, 'skip')} style={{ flex: 1 }} />
              <Button kind="lime" icon="checkmark" title="Taken" onPress={() => answerSlot(date, time, 'taken')} style={{ flex: 1.4 }} />
            </Row>
          </Card>
        </Animated.View>
      ))}

      {low.map((x) => {
        const left = stockLeft(x, s.intakes)!;
        const d = daysLeft(x, s.intakes)!;
        return (
          <Animated.View key={x.id} layout={layout}>
            <Card style={{ borderColor: alpha(colors.amber, 0.4) }}>
              <Row>
                <Icon name="cart.fill" size={18} color={colors.amber} />
                <View style={{ flex: 1 }}>
                  <T v="caption" color={colors.amber}>Running low</T>
                  <T v="headline">{x.name}</T>
                  <T v="footnote" color={colors.dim}>{d <= 0 ? 'Finished' : `About ${d} ${d === 1 ? 'day' : 'days'} left`} · {formatAmount(left, x.stock!.unit)}</T>
                </View>
              </Row>
              <Button small kind="secondary" icon="arrow.clockwise" title="Bought a new pack" onPress={() => s.saveSupplement({ ...x, stock: { ...x.stock!, left: x.stock!.total, at: new Date().toISOString(), warned: undefined } })} />
            </Card>
          </Animated.View>
        );
      })}

      {!due.length && !low.length && !s.inbox.length && (
        <View style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.xxl }}>
          <Icon name="bell.slash" size={28} color={colors.faint} />
          <T v="label" color={colors.dim}>Nothing here yet</T>
        </View>
      )}

      {s.inbox.length > 0 && (
        <View style={{ gap: space.sm }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="caption" color={colors.faint}>Earlier</T>
            <Press onPress={() => s.set({ inbox: [] })} haptic={false}><T v="footnote" color={colors.cyan}>Clear</T></Press>
          </Row>
          <Card style={{ padding: 0, gap: 0 }}>
            {s.inbox.map((i, n) => (
              <Press key={i.id} haptic={false} onPress={() => i.supplementId && router.push({ pathname: '/intake', params: { id: i.supplementId } })}>
                <Row style={{ padding: space.md, borderTopWidth: n ? 0.5 : 0, borderTopColor: colors.hairline, alignItems: 'flex-start' }}>
                  <Icon name={i.kind === 'restock' ? 'cart.fill' : 'pills.fill'} size={15} color={i.kind === 'restock' ? colors.amber : colors.cyan} />
                  <View style={{ flex: 1 }}>
                    <T v="headline">{i.title}</T>
                    <T v="footnote" color={colors.dim}>{i.body}</T>
                  </View>
                  <T v="caption" color={colors.faint} style={type.num}>{new Date(i.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</T>
                </Row>
              </Press>
            ))}
          </Card>
        </View>
      )}
    </ScrollView>
  );
}

import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../src/components/Icon';
import { SummaryCard } from '../src/components/SummaryCard';
import { Button, Press, Row, T } from '../src/components/ui';
import { personalRecords } from '../src/domain/calc';
import { useStore } from '../src/store';
import { colors, radius, space } from '../src/theme';

const RPE_LABEL = ['', 'Very easy', 'Easy', 'Easy', 'Moderate', 'Moderate', 'Hard', 'Hard', 'Very hard', 'Very hard', 'Max'];

export default function Finish() {
  const router = useRouter();
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const s = useStore();
  const session = s.sessions.find((x) => x.id === s.activeSession);
  const [rpe, setRpe] = useState<number | null>(7);
  // Frozen on open, so the card doesn't change while the sheet is up.
  const [finishedAt] = useState(() => new Date().toISOString());
  const prs = useMemo(() => (session ? personalRecords(s.sessions, { ...session, finishedAt }) : []), [session?.id]);
  if (!session) return null;
  const cardWidth = Math.min(width - space.xl * 2, 380);

  return (
    <ScrollView style={{ backgroundColor: colors.black }} contentContainerStyle={{ paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.xl, paddingHorizontal: space.xl, gap: space.lg, alignItems: 'center' }}>
      <Animated.View entering={reduced ? undefined : FadeInDown.duration(380).springify().dampingRatio(0.8)}>
        <SummaryCard session={{ ...session, finishedAt }} prs={prs} unit={s.profile.unit} width={cardWidth} />
      </Animated.View>
      <Animated.View entering={reduced ? undefined : FadeIn.delay(450).duration(300)}>
        <Row gap={6}><Icon name="arrow.left.arrow.right" size={12} color={colors.faint} /><T v="label" color={colors.faint}>Swipe the card to turn it</T></Row>
      </Animated.View>

      <View style={{ gap: space.sm, alignSelf: 'stretch' }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="caption" color={colors.faint}>How hard was it?</T>
          <T v="caption" color={colors.cyan}>{rpe ? `${rpe} · ${RPE_LABEL[rpe]}` : 'Skip'}</T>
        </Row>
        <Row gap={4}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
            <Press key={v} onPress={() => setRpe(rpe === v ? null : v)} style={{ flex: 1, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: rpe !== null && v <= rpe ? (v >= 9 ? colors.amber : colors.cyan) : colors.surface2 }}>
              <T v="label" color={rpe !== null && v <= rpe ? colors.black : colors.dim} style={{ fontWeight: '700' }}>{v}</T>
            </Press>
          ))}
        </Row>
      </View>

      <Button style={{ alignSelf: 'stretch' }} kind="lime" title="Save workout" icon="checkmark" onPress={() => {
        s.finishSession(session.id, rpe);
        router.dismissAll();
      }} />
      <Row style={{ justifyContent: 'center' }} gap={space.xl}>
        <Press onPress={() => router.back()}><T v="label" color={colors.dim}>Keep training</T></Press>
        <Press onPress={() => { s.discardSession(session.id); router.dismissAll(); }}><T v="label" color={colors.red}>Discard</T></Press>
      </Row>
    </ScrollView>
  );
}

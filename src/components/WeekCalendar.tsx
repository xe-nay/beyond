// Week strip that pages through weeks with a swipe. The month above follows the visible week; a
// double tap on the strip or the month comes back to today. Tapping a trained day opens that workout.
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { FlatList, Platform, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { weekStart } from '../domain/calc';
import { activeProgram, today, useStore } from '../store';
import { alpha, colors, space, type } from '../theme';
import { Icon } from './Icon';
import { Press, Row, T } from './ui';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const BACK = 104; // weeks reachable in the past
const AHEAD = 52;
const WEEKS = Array.from({ length: BACK + AHEAD + 1 }, (_, i) => i - BACK);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

/** "October 2026", or "Oct – Nov 2026" for a week across two months. */
function monthLabel(monday: Date) {
  const sunday = addDays(monday, 6);
  if (monday.getMonth() === sunday.getMonth()) return { month: MONTHS[monday.getMonth()], year: monday.getFullYear() };
  return { month: `${MONTHS[monday.getMonth()].slice(0, 3)} – ${MONTHS[sunday.getMonth()].slice(0, 3)}`, year: sunday.getFullYear() };
}

export function WeekCalendar() {
  const router = useRouter();
  const s = useStore();
  const program = activeProgram(s);
  const [width, setWidth] = useState(0);
  const [offset, setOffset] = useState(0); // weeks from this one
  const list = useRef<FlatList<number>>(null);
  const lastTap = useRef(0);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jumping = useRef(0);

  const thisMonday = weekStart();
  const todayIso = today();
  const monday = addDays(thisMonday, offset * 7);
  const label = monthLabel(monday);

  const goToday = () => {
    jumping.current = Date.now();
    list.current?.scrollToIndex({ index: BACK, animated: true });
    setOffset(0);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  // One tap waits briefly so a second tap can turn it into "back to today".
  const tap = (single?: () => void) => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (pending.current) clearTimeout(pending.current);
      pending.current = null;
      lastTap.current = 0;
      return goToday();
    }
    lastTap.current = now;
    if (single) pending.current = setTimeout(() => { pending.current = null; single(); }, 300);
  };

  // The month follows the week most in view, already while swiping.
  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!width) return;
    const next = Math.round(e.nativeEvent.contentOffset.x / width) - BACK;
    if (next !== offset) {
      setOffset(next);
      // No tick per week passed while flying back to today.
      if (Platform.OS !== 'web' && Date.now() - jumping.current > 800) Haptics.selectionAsync().catch(() => {});
    }
  };

  const renderWeek = useCallback(({ item }: { item: number }) => {
    const start = addDays(thisMonday, item * 7);
    return (
      <Row style={{ width, justifyContent: 'space-between' }}>
        {DAYS.map((d, i) => {
          const day = addDays(start, i);
          const iso = today(day);
          const session = s.sessions.find((x) => x.finishedAt && x.date === iso);
          const trained = !!session || s.cardio.some((c) => c.completed && c.date === iso);
          const planned = iso >= todayIso && (program?.days.some((p) => p.weekday === i) || s.sessions.some((x) => !x.startedAt && x.date === iso) || s.cardio.some((c) => !c.completed && c.date === iso));
          const isToday = iso === todayIso;
          const first = day.getDate() === 1;
          return (
            <Press key={i} haptic={false} onPress={() => tap(session ? () => router.push(`/session/${session.id}`) : undefined)}>
              <View style={{ alignItems: 'center', gap: 6 }}>
                <T v="caption" color={isToday ? colors.cyan : colors.faint}>{first ? MONTHS[day.getMonth()].slice(0, 3) : d}</T>
                <View style={{
                  width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: trained ? colors.lime : isToday ? colors.cyanSoft : colors.surface,
                  borderWidth: planned && !trained ? 1.5 : 0, borderColor: isToday ? colors.cyan : colors.hairlineStrong,
                }}>
                  {trained ? <Icon name="checkmark" size={14} color={colors.black} /> : <T v="label" color={isToday ? colors.cyan : iso < todayIso ? colors.faint : colors.dim} style={type.num}>{day.getDate()}</T>}
                </View>
              </View>
            </Press>
          );
        })}
      </Row>
    );
  }, [width, s.sessions, s.cardio, program, todayIso]);

  return (
    <View style={{ gap: space.md }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <Press haptic={false} onPress={() => tap()}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Animated.View key={`${label.month}${label.year}`} entering={FadeIn.duration(180)}>
            <Row gap={6} style={{ alignItems: 'baseline' }}>
              <T v="title3">{label.month}</T>
              <T v="headline" color={colors.faint} style={type.num}>{label.year}</T>
            </Row>
          </Animated.View>
          {offset !== 0 && (
            <Press haptic={false} onPress={goToday} style={{ paddingHorizontal: 12, height: 28, borderRadius: 14, justifyContent: 'center', backgroundColor: alpha(colors.cyan, 0.14) }}>
              <T v="footnote" color={colors.cyan}>Today</T>
            </Press>
          )}
        </Row>
      </Press>
      {width > 0 ? (
        <FlatList
          ref={list}
          data={WEEKS}
          keyExtractor={(w) => String(w)}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={BACK}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          onScroll={settle}
          scrollEventThrottle={32}
          renderItem={renderWeek}
          extraData={renderWeek}
          // The browser preview snaps only to rendered weeks, so it renders them all; the phone pages natively.
          windowSize={Platform.OS === 'web' ? WEEKS.length : 5}
          initialNumToRender={Platform.OS === 'web' ? WEEKS.length : 1}
          maxToRenderPerBatch={3}
        />
      ) : (
        <View style={{ height: 62 }} />
      )}
    </View>
  );
}

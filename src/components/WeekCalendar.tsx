// A strip of days that scrolls one day at a time, today in the middle. The month above follows the
// day in the centre; a double tap on the strip or the month brings today back to the middle.
// Tapping a day opens it: what was done, or what is planned.
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Platform, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { importedUntil, programCovers } from '../schedule';
import { activeProgram, today, useStore } from '../store';
import { alpha, colors, space, type } from '../theme';
import { Icon } from './Icon';
import { Press, Row, T } from './ui';

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const BACK = 730; // days reachable in the past
const AHEAD = 365;
const DAYS = Array.from({ length: BACK + AHEAD + 1 }, (_, i) => i - BACK);
const VISIBLE = 7;
const MID = Math.floor(VISIBLE / 2);
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

/**
 * The scrolling week strip. With `onSelect`, a tap picks the day in place (the chosen one has a ring,
 * and the strip follows it when the day changes elsewhere); without, it opens the day's page.
 */
export function WeekCalendar({ selected, onSelect }: { selected?: string; onSelect?: (iso: string) => void } = {}) {
  const router = useRouter();
  const s = useStore();
  const program = activeProgram(s);
  const [width, setWidth] = useState(0);
  const [offset, setOffset] = useState(0); // days from today at the centre
  const list = useRef<FlatList<number>>(null);
  const lastTap = useRef(0);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jumping = useRef(0);

  const cell = width / VISIBLE;
  const base = new Date();
  base.setHours(12, 0, 0, 0);
  const todayIso = today();
  const centre = addDays(base, offset);
  const until = importedUntil(s);

  const goToday = () => {
    jumping.current = Date.now();
    list.current?.scrollToOffset({ offset: (BACK - MID) * cell, animated: true });
    setOffset(0);
    onSelect?.(todayIso);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  // Keeps the chosen day in view when it changes by a swipe of the page.
  useEffect(() => {
    if (!selected || !cell) return;
    const d = Math.round((Date.parse(`${selected}T12:00:00`) - base.getTime()) / 86400000);
    if (Math.abs(d - offset) <= MID - 1) return;
    jumping.current = Date.now();
    list.current?.scrollToOffset({ offset: (d - MID + BACK) * cell, animated: true });
    setOffset(d);
  }, [selected, cell]);

  // One tap waits briefly (about the iOS double-tap window) so a second tap can turn it into "back to today".
  // Returns true when this tap was the second of a double tap (and went back to today).
  const tap = (single?: () => void) => {
    const now = Date.now();
    if (now - lastTap.current < 400) {
      if (pending.current) clearTimeout(pending.current);
      pending.current = null;
      lastTap.current = 0;
      goToday();
      return true;
    }
    lastTap.current = now;
    if (single) pending.current = setTimeout(() => { pending.current = null; single(); }, 400);
    return false;
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!cell) return;
    const next = Math.round(e.nativeEvent.contentOffset.x / cell) + MID - BACK;
    if (next !== offset) {
      setOffset(next);
      // A light tick per day while scrolling by hand, none while flying back to today.
      if (Platform.OS !== 'web' && Date.now() - jumping.current > 800) Haptics.selectionAsync().catch(() => {});
    }
  };

  const renderDay = useCallback(({ item }: { item: number }) => {
    const day = addDays(base, item);
    const iso = today(day);
    const wd = (day.getDay() + 6) % 7;
    const trained = s.sessions.some((x) => x.finishedAt && x.date === iso) || s.cardio.some((c) => c.completed && c.date === iso);
    const planned = iso >= todayIso && (
      s.sessions.some((x) => !x.startedAt && x.date === iso) ||
      s.cardio.some((c) => !c.completed && c.plan && c.date === iso) ||
      (!!program?.days.some((p) => p.weekday === wd) && programCovers(s, iso, until))
    );
    const isToday = iso === todayIso;
    const chosen = !!selected && iso === selected;
    const first = day.getDate() === 1;
    return (
      <Press haptic={false} onPress={() => {
        if (!onSelect) return tap(() => router.push(`/day/${iso}`));
        // Picks at once; a quick second tap means "back to today" and picks today instead.
        if (tap()) return;
        onSelect(iso);
        if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
      }} style={{ width: cell, alignItems: 'center', gap: 6 }}>
        <T v="caption" color={isToday ? colors.cyan : first ? colors.dim : colors.faint}>{first ? MONTHS[day.getMonth()].slice(0, 3) : LETTERS[wd]}</T>
        <View style={{ padding: 2, borderRadius: 23, borderWidth: 2, borderColor: chosen && !isToday ? colors.text : chosen ? colors.cyan : 'transparent' }}>
        <View style={{
          width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
          backgroundColor: trained ? colors.lime : isToday ? colors.cyanSoft : colors.surface,
          borderWidth: !trained && (isToday || planned) ? 1.5 : 0,
          borderColor: isToday ? colors.cyan : colors.hairlineStrong,
        }}>
          {trained ? <Icon name="checkmark" size={14} color={colors.black} /> : <T v="label" color={isToday ? colors.cyan : chosen ? colors.text : iso < todayIso ? colors.faint : colors.dim} style={type.num}>{day.getDate()}</T>}
        </View>
        </View>
      </Press>
    );
  }, [cell, s.sessions, s.cardio, program, todayIso, until, selected, onSelect]);

  const away = Math.abs(offset) > MID || centre.getMonth() !== base.getMonth();
  return (
    <View style={{ gap: space.md }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <Press haptic={false} onPress={() => tap()}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Animated.View key={`${centre.getMonth()}-${centre.getFullYear()}`} entering={FadeIn.duration(180)}>
            <Row gap={6} style={{ alignItems: 'baseline' }}>
              <T v="title3">{MONTHS[centre.getMonth()]}</T>
              <T v="headline" color={colors.faint} style={type.num}>{centre.getFullYear()}</T>
            </Row>
          </Animated.View>
          {away ? (
            <Press haptic={false} onPress={goToday} style={{ paddingHorizontal: 12, height: 28, borderRadius: 14, justifyContent: 'center', backgroundColor: alpha(colors.cyan, 0.14) }}>
              <T v="footnote" color={colors.cyan}>Today</T>
            </Press>
          ) : null}
        </Row>
      </Press>
      {cell > 0 ? (
        <FlatList
          ref={list}
          data={DAYS}
          keyExtractor={(d) => String(d)}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={cell}
          decelerationRate="fast"
          initialScrollIndex={BACK - MID}
          getItemLayout={(_, index) => ({ length: cell, offset: cell * index, index })}
          onScroll={onScroll}
          scrollEventThrottle={32}
          renderItem={renderDay}
          extraData={renderDay}
          initialNumToRender={VISIBLE + 2}
          windowSize={Platform.OS === 'web' ? 41 : 7}
          maxToRenderPerBatch={14}
        />
      ) : (
        <View style={{ height: 70 }} />
      )}
    </View>
  );
}

import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion, ZoomIn } from 'react-native-reanimated';

import { today } from '../store';
import { alpha, colors, type } from '../theme';
import { relative } from './DayDetail';
import { T } from './ui';

/** "Tue 27 Oct". */
export const shortDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

/**
 * The day, big in the middle of the screen for a moment after it changes, so a swipe that moves to
 * another day is never missed. Cyan for today, amber for any other day.
 */
export function DayFlash({ date }: { date: string }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState<string | null>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setShown(date);
    const id = setTimeout(() => setShown(null), 950);
    return () => clearTimeout(id);
  }, [date]);
  const away = shown !== null && shown !== today();
  const tint = away ? colors.amber : colors.cyan;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
      {shown && (
        <Animated.View
          key={shown}
          entering={reduced ? FadeIn.duration(120) : ZoomIn.springify().dampingRatio(0.72)}
          exiting={FadeOut.duration(220)}
          style={{ alignItems: 'center', gap: 2, paddingHorizontal: 28, paddingVertical: 18, borderRadius: 26, backgroundColor: 'rgba(14,17,24,0.94)', borderWidth: 1.5, borderColor: alpha(tint, 0.7) }}>
          <T v="caption" color={tint}>{relative(shown)}</T>
          <T v="largeTitle" style={type.num}>{new Date(`${shown}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long' })}</T>
          <T v="title3" color={colors.dim}>{new Date(`${shown}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}</T>
        </Animated.View>
      )}
    </View>
  );
}

import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { innerSwipe, releaseInner } from '../swipeGuard';
import { colors } from '../theme';
import { Icon } from './Icon';

const OPEN = 84; // how far left, in points, opens it

const buzz = () => Platform.OS !== 'web' && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

/**
 * A row that opens by swiping it left: it moves slowly under the finger, an eye appears behind it,
 * and letting go past the eye opens it. A swipe to the right is left to the page (changing day).
 */
export function SwipeOpen({ children, onOpen, background = 'transparent' }: { children: ReactNode; onOpen: () => void; background?: string }) {
  const x = useSharedValue(0);
  const past = useSharedValue(0);
  const pan = Gesture.Pan()
    .activeOffsetX([-10, 9999])
    .failOffsetX([-9999, 12])
    .failOffsetY([-10, 10])
    .onStart(() => innerSwipe.set(1))
    .onUpdate((e) => {
      // Slower than the finger, so it reads as a deliberate pull.
      x.set(Math.min(0, e.translationX * 0.55));
      const over = x.get() <= -OPEN ? 1 : 0;
      if (over !== past.get()) { past.set(over); scheduleOnRN(buzz); }
    })
    .onEnd(() => {
      if (x.get() <= -OPEN) scheduleOnRN(onOpen);
      x.set(withSpring(0, { duration: 380, dampingRatio: 0.85 }));
      past.set(0);
    })
    .onFinalize(() => scheduleOnRN(releaseInner));

  const row = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const eye = useAnimatedStyle(() => ({
    opacity: interpolate(-x.get(), [8, OPEN * 0.7], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(-x.get(), [OPEN * 0.6, OPEN, OPEN * 1.3], [0.8, 1.15, 1.25], Extrapolation.CLAMP) }],
  }));
  const eyeTint = useAnimatedStyle(() => ({ backgroundColor: x.get() <= -OPEN ? colors.cyan : colors.surface3 }));

  return (
    <View>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'flex-end', justifyContent: 'center' }]} pointerEvents="none">
        <Animated.View style={[{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginRight: 6 }, eye, eyeTint]}>
          <Icon name="eye.fill" size={15} color={colors.text} />
        </Animated.View>
      </View>
      <GestureDetector gesture={pan}>
        <Animated.View style={[{ backgroundColor: background }, row]}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

// Swiping a page sideways to change day (left: next, right: previous). The page follows the finger,
// slides out, and the next day slides in from the other side, so the change is seen as it happens.
import { useWindowDimensions } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { Extrapolation, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { innerSwipe, markSwipe } from './swipeGuard';

/** `step` moves the day by ±1; `canStep` says whether there is a day that way. */
export function useDaySwipe(step: (n: 1 | -1) => void, canStep: (n: 1 | -1) => boolean = () => true) {
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const x = useSharedValue(0);
  const canNext = canStep(1);
  const canPrev = canStep(-1);

  const arrive = (n: 1 | -1) => {
    step(n);
    if (reduced) return;
    x.set(withSequence(withTiming(n * width * 0.35, { duration: 0 }), withSpring(0, { duration: 420, dampingRatio: 0.9 })));
  };
  const go = (n: 1 | -1) => {
    if (!canStep(n)) return void x.set(withSpring(0, { duration: 350, dampingRatio: 0.85 }));
    if (reduced) return arrive(n);
    x.set(withTiming(-n * width * 0.45, { duration: 150 }, (done) => { if (done) scheduleOnRN(arrive, n); }));
  };

  const gesture = Gesture.Pan()
    .activeOffsetX([-28, 28])
    .failOffsetY([-14, 14])
    .onStart(() => scheduleOnRN(markSwipe))
    .onUpdate((e) => {
      if (reduced || innerSwipe.get()) return;
      // Where there is no day, the page only gives a little.
      const blocked = (e.translationX < 0 && !canNext) || (e.translationX > 0 && !canPrev);
      x.set(e.translationX * (blocked ? 0.15 : 0.8));
    })
    .onEnd((e) => {
      scheduleOnRN(markSwipe);
      if (innerSwipe.get()) return void x.set(withSpring(0, { duration: 300, dampingRatio: 0.9 }));
      const far = Math.abs(e.translationX) > 60 || Math.abs(e.velocityX) > 600;
      if (far) scheduleOnRN(go, e.translationX < 0 ? 1 : -1);
      else x.set(withSpring(0, { duration: 350, dampingRatio: 0.85 }));
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }],
    opacity: interpolate(Math.abs(x.get()), [0, width * 0.45], [1, 0.25], Extrapolation.CLAMP),
  }));

  return { gesture, style, go };
}

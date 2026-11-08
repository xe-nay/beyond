// The weight lifted so far in a session (working sets: weight × reps), next to the session clock. It
// counts up to the new total after each set and glows for a moment, so a set's contribution is felt.
import { useEffect, useRef, useState } from 'react';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { toDisplay } from '../domain/plates';
import { colors, type } from '../theme';
import { T } from './ui';

const fmt = (v: number) => Math.round(v).toLocaleString('en-US');

export function SessionVolume({ kg, unit }: { kg: number; unit: 'kg' | 'lb' }) {
  const target = toDisplay(kg, unit);
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  const reduced = useReducedMotion();
  const glow = useSharedValue(0);

  useEffect(() => {
    const start = from.current;
    from.current = target;
    if (start === target) return;
    if (reduced || target < start) return setShown(target);
    glow.set(withSequence(withTiming(1, { duration: 120 }), withTiming(0, { duration: 900 })));
    const t0 = Date.now();
    const id = setInterval(() => {
      const p = Math.min(1, (Date.now() - t0) / 450);
      // Ease out: fast at first, settling on the total.
      setShown(start + (target - start) * (1 - (1 - p) ** 3));
      if (p >= 1) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [target]);

  const style = useAnimatedStyle(() => ({ opacity: 0.75 + glow.get() * 0.25, transform: [{ scale: 1 + glow.get() * 0.06 }] }));
  return (
    <Animated.View style={style}>
      <T v="footnote" color={colors.lime} style={[type.num, { fontWeight: '600' }]}>
        {fmt(shown)} {unit} <T v="footnote" color={colors.dim}>lifted</T>
      </T>
    </Animated.View>
  );
}

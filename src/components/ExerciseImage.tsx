// Exercise picture. With a start and a peak frame it loops between them, which reads as a slow
// demonstration of the movement. Images are cached on disk after the first view.
import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import type { Exercise } from '../domain/types';
import { colors, radius } from '../theme';
import { Icon } from './Icon';

const AImage = Animated.createAnimatedComponent(Image);

export function ExerciseImage({ exercise, style, animate = true, thumb }: { exercise: Exercise; style?: StyleProp<ViewStyle>; animate?: boolean; thumb?: boolean }) {
  const reduced = useReducedMotion();
  const [a, b] = exercise.images;
  const fade = useSharedValue(0);
  const loop = animate && !!b && !reduced && !thumb;

  useEffect(() => {
    if (!loop) return;
    const ease = Easing.bezier(0.77, 0, 0.175, 1);
    fade.set(withRepeat(withSequence(withDelay(700, withTiming(1, { duration: 650, easing: ease })), withDelay(700, withTiming(0, { duration: 650, easing: ease }))), -1));
  }, [loop]);
  const top = useAnimatedStyle(() => ({ opacity: fade.get() }));

  // RepDB illustrations sit on white; photos are full-bleed. Both get the same rounded frame.
  const illustration = exercise.src === 'r';
  return (
    <View style={[styles.frame, illustration && { backgroundColor: '#F3F5F9' }, style]}>
      {a ? (
        <>
          <Image source={a} style={StyleSheet.absoluteFill} contentFit={illustration ? 'contain' : 'cover'} cachePolicy="disk" transition={150} recyclingKey={a} />
          {loop && <AImage source={b} style={[StyleSheet.absoluteFill, top]} contentFit={illustration ? 'contain' : 'cover'} cachePolicy="disk" />}
        </>
      ) : (
        <View style={styles.placeholder}><Icon name="figure.strengthtraining.traditional" size={thumb ? 20 : 40} color={colors.faint} /></View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', borderRadius: radius.md, backgroundColor: colors.surface2 },
  placeholder: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
});

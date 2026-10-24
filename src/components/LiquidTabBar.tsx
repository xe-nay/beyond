// Floating glass tab bar, icons only. A glass lens moves to the active tab like a drop of liquid:
// the leading edge springs ahead, the trailing edge follows more slowly, so it stretches in flight
// and settles back into shape when it lands.
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../theme';
import { Icon, type IconName } from './Icon';

const ICONS: Record<string, IconName> = {
  today: 'sun.max.fill', train: 'dumbbell.fill', food: 'fork.knife', progress: 'chart.xyaxis.line', profile: 'person.crop.circle',
};
const LABELS: Record<string, string> = { today: 'Today', train: 'Train', food: 'Food', progress: 'Progress', profile: 'Profile' };
const LEAD = { duration: 340, dampingRatio: 0.82 };
const TRAIL = { duration: 560, dampingRatio: 0.9 };
const glass = Platform.OS === 'ios' && isLiquidGlassAvailable();

function Item({ name, focused, onPress, onLongPress }: { name: string; focused: boolean; onPress: () => void; onLongPress: () => void }) {
  const reduced = useReducedMotion();
  const pop = useSharedValue(1);
  useEffect(() => {
    if (focused && !reduced) pop.set(withSequence(withTiming(0.86, { duration: 90 }), withSpring(1, { duration: 420, dampingRatio: 0.45 })));
  }, [focused]);
  const icon = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() }, { translateY: focused ? -1 : 0 }] }));
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={styles.item} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={LABELS[name]}>
      <Animated.View style={icon}>
        <Icon name={ICONS[name] ?? 'circle'} size={24} color={focused ? colors.text : colors.dim} weight={focused ? 'bold' : 'medium'} />
      </Animated.View>
    </Pressable>
  );
}

export function LiquidTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const routes = state.routes.filter((r) => ICONS[r.name]);
  const index = Math.max(0, routes.findIndex((r) => r.key === state.routes[state.index].key));
  const PAD = 4;
  const slot = Math.max(0, width - PAD * 2) / Math.max(1, routes.length);

  // The lens's two edges chase the new tab at different speeds, so it stretches as it travels.
  const head = useSharedValue(0);
  const tail = useSharedValue(0);
  const ready = useSharedValue(0);
  const LW = slot - 8;

  useEffect(() => {
    if (!slot) return;
    const left = PAD + slot * index + 4;
    if (!ready.get() || reduced) {
      head.set(left);
      tail.set(left);
      ready.set(1);
      return;
    }
    const right = left > head.get();
    head.set(withSpring(left, right ? LEAD : TRAIL));
    tail.set(withSpring(left, right ? TRAIL : LEAD));
  }, [index, slot]);

  const lensStyle = useAnimatedStyle(() => {
    const a = Math.min(head.get(), tail.get());
    const b = Math.max(head.get(), tail.get()) + LW;
    return { left: a, width: b - a };
  });

  const body = (
    <View style={styles.row} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {slot > 0 && <Animated.View style={[styles.lens, lensStyle]} />}
      {routes.map((route) => {
        const focused = route.key === state.routes[state.index].key;
        return (
          <Item
            key={route.key}
            name={route.name}
            focused={focused}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) {
                if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
                navigation.navigate(route.name, route.params);
              }
            }}
            onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
          />
        );
      })}
    </View>
  );

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom - 6, 10) }]}>
      {glass ? (
        <GlassView glassEffectStyle="regular" colorScheme="dark" isInteractive style={styles.bar}>{body}</GlassView>
      ) : Platform.OS === 'ios' ? (
        <BlurView intensity={70} tint="systemChromeMaterialDark" style={styles.bar}>{body}</BlurView>
      ) : (
        <View style={[styles.bar, styles.webGlass]}>{body}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 40, right: 40 },
  bar: { height: 60, borderRadius: 30, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.14)' },
  webGlass: { backgroundColor: 'rgba(28, 32, 42, 0.72)', backdropFilter: 'blur(24px) saturate(180%)' } as any,
  row: { flex: 1, flexDirection: 'row', paddingHorizontal: 4 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  lens: { position: 'absolute', left: 0, top: 6, bottom: 6, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.09)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.16)' },
});

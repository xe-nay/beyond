// The live cardio screen's visuals: activity-style rings driven on the UI thread, phase-coloured
// ambient light with a breathing guide in recovery, round dots, glass buttons and hold-to-end.
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import * as Haptics from 'expo-haptics';
import { useEffect, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation, Easing, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import type { PhaseKind } from '../domain/intervals';
import { alpha, colors } from '../theme';

export const PHASE: Record<PhaseKind, { a: string; b: string; glow: string; label: string }> = {
  warmup: { a: '#FFB340', b: '#FFD60A', glow: '#B8741A', label: 'Warm-up' },
  work: { a: '#40E0F0', b: '#2F7BFF', glow: '#1FA8C9', label: 'Work' },
  recovery: { a: '#C2F95C', b: '#34C759', glow: '#6FBF2E', label: 'Recover' },
  cooldown: { a: '#7D8BFF', b: '#40E0F0', glow: '#4B5BD6', label: 'Cool-down' },
};

const ACircle = Animated.createAnimatedComponent(Circle);
const glassOK = Platform.OS === 'ios' && isLiquidGlassAvailable();

/**
 * A ring that drains from `from` to empty over `seconds`, animated entirely on the UI thread.
 * `running` false freezes it where it is.
 */
function useDrain(from: number, seconds: number, running: boolean, key: string | number) {
  const p = useSharedValue(from);
  useEffect(() => {
    cancelAnimation(p);
    p.set(from);
    if (running && seconds > 0) p.set(withTiming(0, { duration: seconds * 1000, easing: Easing.linear }));
  }, [key, running]);
  return p;
}

export function PhaseRings({ size, kind, phaseLeft, phaseSeconds, sessionLeft, sessionSeconds, running, phaseKey, children }: {
  size: number; kind: PhaseKind; phaseLeft: number; phaseSeconds: number; sessionLeft: number; sessionSeconds: number; running: boolean; phaseKey: number; children?: ReactNode;
}) {
  const outerW = 22, innerW = 10, gap = 8;
  const rO = (size - outerW) / 2;
  const rI = rO - outerW / 2 - gap - innerW / 2;
  const cO = 2 * Math.PI * rO;
  const cI = 2 * Math.PI * rI;
  const c = size / 2;
  // Fractions remaining; they count down linearly to the end of the phase / session.
  const phase = useDrain(phaseSeconds ? phaseLeft / phaseSeconds : 0, phaseLeft, running, `${phaseKey}`);
  const session = useDrain(sessionSeconds ? sessionLeft / sessionSeconds : 0, sessionLeft, running, `${phaseKey}`);
  const outer = useAnimatedProps(() => ({ strokeDashoffset: cO * (1 - phase.get()) }));
  const inner = useAnimatedProps(() => ({ strokeDashoffset: cI * (1 - session.get()) }));
  // The glowing tip sits where the outer ring ends.
  const tip = useAnimatedProps(() => {
    const ang = -Math.PI / 2 + 2 * Math.PI * phase.get();
    return { cx: c + rO * Math.cos(ang), cy: c + rO * Math.sin(ang), opacity: phase.get() > 0.01 ? 1 : 0 };
  });
  const p = PHASE[kind];
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={p.a} />
            <Stop offset="1" stopColor={p.b} />
          </LinearGradient>
        </Defs>
        <Circle cx={c} cy={c} r={rO} stroke={alpha(p.a, 0.14)} strokeWidth={outerW} fill="none" />
        <Circle cx={c} cy={c} r={rI} stroke="rgba(255,255,255,0.08)" strokeWidth={innerW} fill="none" />
        <ACircle cx={c} cy={c} r={rO} stroke="url(#ring)" strokeWidth={outerW} fill="none" strokeLinecap="round" strokeDasharray={cO} animatedProps={outer} rotation={-90} origin={`${c}, ${c}`} />
        <ACircle cx={c} cy={c} r={rI} stroke="rgba(255,255,255,0.85)" strokeWidth={innerW} fill="none" strokeLinecap="round" strokeDasharray={cI} animatedProps={inner} rotation={-90} origin={`${c}, ${c}`} />
        <ACircle r={outerW / 2 - 3} fill="#FFFFFF" animatedProps={tip} />
      </Svg>
      {children}
    </View>
  );
}

/** Light behind the rings in the phase colour; it breathes (4 s in, 4 s out) during recovery. */
export function Ambient({ kind, pulseKey }: { kind: PhaseKind; pulseKey: number }) {
  const reduced = useReducedMotion();
  const breathe = useSharedValue(1);
  const burst = useSharedValue(1); // 1 = finished, so nothing shows until a phase changes
  useEffect(() => {
    cancelAnimation(breathe);
    if (kind === 'recovery' && !reduced) {
      breathe.set(withRepeat(withSequence(withTiming(1.12, { duration: 4000, easing: Easing.inOut(Easing.sin) }), withTiming(0.92, { duration: 4000, easing: Easing.inOut(Easing.sin) })), -1));
    } else breathe.set(withTiming(1, { duration: 600 }));
  }, [kind]);
  useEffect(() => {
    if (reduced || !pulseKey) return;
    burst.set(0);
    burst.set(withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [pulseKey]);
  const glow = useAnimatedStyle(() => ({ transform: [{ scale: breathe.get() }] }));
  const ring = useAnimatedStyle(() => ({ opacity: 0.55 * (1 - burst.get()), transform: [{ scale: 0.8 + 0.7 * burst.get() }] }));
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {(Object.keys(PHASE) as PhaseKind[]).map((k) => (
        <Animated.View key={k} style={[StyleSheet.absoluteFill, glow, { opacity: k === kind ? 1 : 0, transitionProperty: 'opacity', transitionDuration: 700 } as any]}>
          <Svg width="100%" height="100%">
            <Defs>
              <RadialGradient id={`g-${k}`} cx="50%" cy="42%" r="55%">
                <Stop offset="0" stopColor={PHASE[k].glow} stopOpacity={0.55} />
                <Stop offset="0.55" stopColor={PHASE[k].glow} stopOpacity={0.12} />
                <Stop offset="1" stopColor="#000000" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect width="100%" height="100%" fill={`url(#g-${k})`} />
          </Svg>
        </Animated.View>
      ))}
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', marginTop: -60 }]}>
        <Animated.View style={[{ width: 320, height: 320, borderRadius: 160, borderWidth: 2, borderColor: PHASE[kind].a }, ring]} />
      </View>
    </View>
  );
}

/** One dot per round: done (filled), current (a stretched pill), upcoming (outline). */
export function RoundDots({ rounds, current, done, tint }: { rounds: number; current: number; done: number; tint: string }) {
  if (rounds <= 1) return null;
  return (
    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', maxWidth: 300 }}>
      {Array.from({ length: rounds }, (_, i) => {
        const isDone = i < done;
        const isCur = i + 1 === current;
        return (
          <View key={i} style={[{
            height: 8, borderRadius: 4, width: isCur ? 26 : 8,
            backgroundColor: isCur ? tint : isDone ? 'rgba(255,255,255,0.75)' : 'transparent',
            borderWidth: isCur || isDone ? 0 : 1.5, borderColor: 'rgba(255,255,255,0.25)',
            transitionProperty: ['width', 'backgroundColor'], transitionDuration: 320,
          } as any]} />
        );
      })}
    </View>
  );
}

/** A glass surface: real Liquid Glass on iOS 26, blur before that, translucent on the web. */
export function Glass({ children, style, round }: { children: ReactNode; style?: StyleProp<ViewStyle>; round?: boolean }) {
  const shape = [styles.glass, round && { borderRadius: 999 }, style];
  if (glassOK) return <GlassView glassEffectStyle="regular" colorScheme="dark" style={shape}>{children}</GlassView>;
  if (Platform.OS === 'ios') return <BlurView intensity={50} tint="systemThinMaterialDark" style={shape}>{children}</BlurView>;
  return <View style={[shape, styles.webGlass]}>{children}</View>;
}

export function GlassButton({ size, onPress, children, tint }: { size: number; onPress: () => void; children: ReactNode; tint?: string }) {
  const s = useSharedValue(1);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: s.get() }] }));
  return (
    <Pressable
      onPressIn={() => s.set(withTiming(0.92, { duration: 110 }))}
      onPressOut={() => s.set(withSpring(1, { duration: 380, dampingRatio: 0.55 }))}
      onPress={() => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onPress(); }}>
      <Animated.View style={st}>
        {tint ? (
          <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: tint, alignItems: 'center', justifyContent: 'center', shadowColor: tint, shadowOpacity: 0.5, shadowRadius: 18 }}>{children}</View>
        ) : (
          <Glass round style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>{children}</Glass>
        )}
      </Animated.View>
    </Pressable>
  );
}

/** Hold for 0.8 s to confirm; a ring fills around the button while held. */
export function HoldButton({ size, onConfirm, children }: { size: number; onConfirm: () => void; children: ReactNode }) {
  const fill = useSharedValue(0);
  const r = size / 2 - 2;
  const c = 2 * Math.PI * r;
  const props = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - fill.get()) }));
  const done = () => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    onConfirm();
  };
  return (
    <Pressable
      onPressIn={() => {
        fill.set(withTiming(1, { duration: 800, easing: Easing.linear }, (finished) => {
          'worklet';
          if (finished) scheduleOnRN(done);
        }));
      }}
      onPressOut={() => {
        cancelAnimation(fill);
        fill.set(withTiming(0, { duration: 200 }));
      }}>
      <Glass round style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <ACircle cx={size / 2} cy={size / 2} r={r} stroke={colors.red} strokeWidth={3} fill="none" strokeLinecap="round" strokeDasharray={c} animatedProps={props} rotation={-90} origin={`${size / 2}, ${size / 2}`} />
        </Svg>
        {children}
      </Glass>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  glass: { borderRadius: 22, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.16)' },
  webGlass: { backgroundColor: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(20px) saturate(160%)' } as any,
});

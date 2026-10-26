import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { cubicBezier, Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withSpring, withTiming, useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { useStore } from '../store';
import { swipedRecently } from '../swipeGuard';
import { alpha, colors, radius, space, type } from '../theme';
import { Icon, type IconName } from './Icon';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
// CSS-transition form of the same curve; native Reanimated rejects a 'cubic-bezier(...)' string.
export const UI_EASE = cubicBezier(0.23, 1, 0.32, 1);
const OUTER = ['flex', 'flexGrow', 'flexShrink', 'flexBasis', 'alignSelf', 'width', 'height', 'aspectRatio', 'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical', 'position', 'top', 'left', 'right', 'bottom', 'maxWidth', 'minWidth'] as const;
export const tap = () => Platform.OS !== 'web' && Haptics.selectionAsync().catch(() => {});
export const thud = () => Platform.OS !== 'web' && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

export function Screen({ children, style, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  // Room for the tab bar, and for the live session dock above it while a session is open.
  const live = useStore((s) => !!s.cardioRun || s.sessions.some((x) => x.id === s.activeSession && !x.finishedAt));
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.black }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[padded && { padding: space.lg, paddingBottom: live ? 190 : 120, gap: space.lg }, style]}
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function T({ children, style, v = 'body', color, numberOfLines }: { children: ReactNode; style?: StyleProp<TextStyle>; v?: keyof typeof type; color?: string; numberOfLines?: number }) {
  return <Text numberOfLines={numberOfLines} style={[{ color: color ?? colors.text }, type[v] as TextStyle, style]}>{children}</Text>;
}

/** Scales to 0.97 on press-in (120 ms, ease-out), the press commits on release. */
export function Press({ children, onPress, style, disabled, haptic = true, onLongPress, hitSlop, label }: {
  children: ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle>; disabled?: boolean; haptic?: boolean; onLongPress?: () => void; hitSlop?: number; label?: string;
}) {
  const [down, setDown] = useState(false);
  // Sizing and placement belong to the touch target; everything else to the scaling view.
  const flat = StyleSheet.flatten(style) ?? {};
  const outer: ViewStyle = {};
  for (const k of OUTER) if (k in flat) (outer as any)[k] = (flat as any)[k];
  const inner: ViewStyle = { ...flat, ...Object.fromEntries(OUTER.filter((k) => k in flat).map((k) => [k, undefined])) };
  if ('flex' in flat || 'height' in flat || 'aspectRatio' in flat) inner.flex = 1;
  return (
    <Pressable
      style={outer}
      disabled={disabled}
      onPressIn={() => setDown(true)}
      onPressOut={() => setDown(false)}
      onLongPress={onLongPress && (() => { if (!swipedRecently()) onLongPress(); })}
      hitSlop={hitSlop}
      accessibilityRole={label ? 'button' : undefined}
      accessibilityLabel={label}
      pressRetentionOffset={12}
      onPress={() => {
        if (swipedRecently()) return;
        if (haptic) tap();
        onPress?.();
      }}>
      <Animated.View
        style={[
          inner,
          { opacity: disabled ? 0.4 : 1, transform: [{ scale: down ? 0.97 : 1 }], transitionProperty: 'transform', transitionDuration: 120, transitionTimingFunction: UI_EASE } as any,
        ]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

export function Card({ children, style, onPress, onLongPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; onLongPress?: () => void }) {
  return onPress || onLongPress
    ? <Press onPress={onPress} onLongPress={onLongPress} haptic={!!onPress} style={[styles.card, style]}>{children}</Press>
    : <View style={[styles.card, style]}>{children}</View>;
}

export function Button({ title, icon, onPress, kind = 'primary', style, disabled, small }: {
  title?: string; icon?: IconName; onPress?: () => void; kind?: 'primary' | 'secondary' | 'ghost' | 'lime' | 'danger'; style?: StyleProp<ViewStyle>; disabled?: boolean; small?: boolean;
}) {
  const bg = { primary: colors.cyan, lime: colors.lime, secondary: colors.surface2, ghost: 'transparent', danger: alpha(colors.red, 0.14) }[kind];
  const fg = kind === 'primary' || kind === 'lime' ? colors.black : kind === 'danger' ? colors.red : colors.text;
  return (
    <Press onPress={onPress} disabled={disabled} style={[styles.button, small && styles.small, { backgroundColor: bg }, !title && { paddingHorizontal: 0, width: small ? 40 : 52 }, style]}>
      {icon && <Icon name={icon} color={fg} size={small ? 15 : 18} />}
      {title && <T v="headline" color={fg} style={small && { fontSize: 14 }}>{title}</T>}
    </Press>
  );
}

export function Row({ children, style, gap = space.md }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Stat({ label, value, unit, color, small }: { label: string; value: string | number; unit?: string; color?: string; small?: boolean }) {
  return (
    <View style={{ gap: 2 }}>
      <T v="caption" color={colors.faint}>{label}</T>
      <Row gap={4} style={{ alignItems: 'baseline' }}>
        <T v={small ? 'title' : 'big'} color={color} style={type.num}>{value}</T>
        {unit && <T v="label" color={colors.dim}>{unit}</T>}
      </Row>
    </View>
  );
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <Row style={{ justifyContent: 'space-between', paddingHorizontal: 4 }}>
        <T v="caption" color={colors.faint}>{title}</T>
        {action}
      </Row>
      {children}
    </View>
  );
}

/** Edges that chase a target at different speeds: the leading edge springs, the trailing one lags. */
function useLiquid(target: number, size: number) {
  const reduced = useReducedMotion();
  const a = useSharedValue(target);
  const b = useSharedValue(target + size);
  const first = useRef(true);
  useEffect(() => {
    if (first.current || reduced) {
      first.current = false;
      a.set(target);
      b.set(target + size);
      return;
    }
    const right = target > a.get();
    const lead = { duration: 300, dampingRatio: 0.8 };
    const trail = { duration: 520, dampingRatio: 0.92 };
    a.set(withSpring(target, right ? trail : lead));
    b.set(withSpring(target + size, right ? lead : trail));
  }, [target, size]);
  return useAnimatedStyle(() => ({ left: a.get(), width: Math.max(0, b.get() - a.get()) }));
}

/** Segmented control: a glass pill that stretches toward the new option, then settles. */
export function Segmented<V extends string | number>({ options, value, onChange, style }: { options: { value: V; label: string }[]; value: V; onChange: (v: V) => void; style?: StyleProp<ViewStyle> }) {
  const [w, setW] = useState(0);
  // No pill when the value matches no option (a mixed choice).
  const found = options.findIndex((o) => o.value === value);
  const i = Math.max(0, found);
  const seg = w / options.length;
  const pill = useLiquid(3 + seg * i, seg);
  return (
    <View style={[styles.segment, style]} onLayout={(e) => setW(e.nativeEvent.layout.width - 6)}>
      {w > 0 && found >= 0 && <Animated.View style={[styles.pill, pill]} />}
      {options.map((o) => (
        <Pressable key={String(o.value)} style={styles.segmentItem} onPress={() => { if (o.value !== value) { tap(); onChange(o.value); } }}>
          <Animated.Text numberOfLines={1} style={[type.footnote, { fontWeight: '600', color: o.value === value ? colors.text : colors.dim, transitionProperty: 'color', transitionDuration: 180 } as any]}>{o.label}</Animated.Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Toggle: glass track, a thumb that stretches as it travels, and a cyan fill that floods in. */
export function Toggle({ value, onChange, tint = colors.cyan }: { value: boolean; onChange: (v: boolean) => void; tint?: string }) {
  const W = 54, H = 32, T = 26, P = 3;
  const thumb = useLiquid(value ? W - T - P : P, T);
  return (
    <Pressable onPress={() => { tap(); onChange(!value); }} hitSlop={8} accessibilityRole="switch" accessibilityState={{ checked: value }}>
      <View style={{ width: W, height: H, borderRadius: H / 2, backgroundColor: colors.surface3, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.12)' }}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: tint, opacity: value ? 1 : 0, transitionProperty: 'opacity', transitionDuration: 220 } as any]} />
        <Animated.View style={[{ position: 'absolute', top: P, height: T, borderRadius: T / 2, backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } }, thumb]} />
      </View>
    </Pressable>
  );
}

export function Chip({ label, active, onPress, onLongPress, icon }: { label: string; active?: boolean; onPress?: () => void; onLongPress?: () => void; icon?: IconName }) {
  return (
    <Press onPress={onPress} onLongPress={onLongPress} style={[styles.chip, active && { backgroundColor: colors.cyanSoft, borderColor: alpha(colors.cyan, 0.5) }]}>
      {icon && <Icon name={icon} size={13} color={active ? colors.cyan : colors.dim} />}
      <T v="footnote" color={active ? colors.cyan : colors.dim} style={{ fontWeight: '500' }}>{label}</T>
    </Press>
  );
}

const ACircle = Animated.createAnimatedComponent(Circle);

/** Progress ring; the stroke animates on the UI thread when the value changes. */
export function Ring({ size = 120, stroke = 10, progress, color = colors.cyan, track = colors.surface3, children }: {
  size?: number; stroke?: number; progress: number; color?: string; track?: string; children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const reduced = useReducedMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    const v = Math.max(0, Math.min(1, progress));
    p.set(reduced ? v : withTiming(v, { duration: 600, easing: EASE_OUT }));
  }, [progress, reduced]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - p.get()) }));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <ACircle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={c} animatedProps={props} rotation={-90} origin={`${size / 2}, ${size / 2}`} />
      </Svg>
      {children}
    </View>
  );
}

export function Bar({ value, max, color = colors.cyan, height = 6 }: { value: number; max: number; color?: string; height?: number }) {
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <View style={{ height, borderRadius: height, backgroundColor: colors.surface3, overflow: 'hidden' }}>
      <Animated.View style={[{ height, borderRadius: height, backgroundColor: color, width: `${pct * 100}%`, transitionProperty: 'width', transitionDuration: 400 } as any]} />
    </View>
  );
}

export function Empty({ icon, title, detail, action }: { icon: IconName; title: string; detail?: string; action?: ReactNode }) {
  return (
    <View style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.xxl }}>
      <View style={styles.emptyIcon}><Icon name={icon} size={26} color={colors.cyan} /></View>
      <T v="headline">{title}</T>
      {detail && <T v="label" color={colors.dim} style={{ textAlign: 'center', maxWidth: 280 }}>{detail}</T>}
      {action}
    </View>
  );
}

export function Divider() {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline }} />;
}

/** Number stepper: tap for one step, hold to repeat. */
/** Reads typed text as a number: "1,5" → 1.5. A value with a colon ("7:30", "1:05:00") as minutes and seconds. */
export function readTyped(text: string, clock = false) {
  const s = text.trim().replace(',', '.');
  if (!s) return null;
  if (s.includes(':')) {
    const parts = s.split(':').map(Number);
    if (parts.some((n) => !Number.isFinite(n))) return null;
    return parts.reduce((n, x) => n * 60 + x, 0);
  }
  const n = parseFloat(s);
  // A plain number for a clock means minutes ("5" → 5:00).
  return Number.isFinite(n) ? (clock ? n * 60 : n) : null;
}

/**
 * − value +. Tap the value to type it instead; `clock` reads what is typed as minutes or M:SS
 * (for values kept in seconds).
 */
export function Stepper({ value, onChange, step = 1, min = 0, max = 9999, format = (v: number) => String(v), label, big, clock }: {
  value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; format?: (v: number) => string; label?: string; big?: boolean; clock?: boolean;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 1000) / 1000));
  const [typing, setTyping] = useState<string | null>(null);
  const commit = () => {
    const n = typing === null ? null : readTyped(typing, clock);
    if (n !== null) onChange(clamp(n));
    setTyping(null);
  };
  const text = [big ? type.big : type.title, type.num, { minWidth: big ? 100 : 56, textAlign: 'center' as const, color: colors.text }];
  return (
    // flexGrow (not flex: 1) so it shares a row evenly but keeps its own height in a column.
    <View style={{ alignItems: 'center', gap: 6, flexGrow: 1, flexShrink: 1 }}>
      {label && <T v="caption" color={colors.faint}>{label}</T>}
      <Row gap={space.sm}>
        <Press onPress={() => onChange(clamp(value - step))} style={styles.step} hitSlop={6} label={`Less ${label ?? ''}`}><Icon name="minus" size={16} /></Press>
        {typing !== null ? (
          <TextInput
            autoFocus selectTextOnFocus value={typing} onChangeText={setTyping} onBlur={commit} onSubmitEditing={commit}
            keyboardType={clock ? 'numbers-and-punctuation' : 'decimal-pad'} returnKeyType="done"
            style={[...text, { paddingVertical: 0, borderRadius: radius.sm, backgroundColor: colors.surface3 }]}
          />
        ) : (
          <Press onPress={() => setTyping(clock ? format(value) : String(value))} haptic={false} label={`${label ?? 'Value'} ${format(value)}, tap to type`}>
            <T v={big ? 'big' : 'title'} numberOfLines={1} style={[type.num, { minWidth: big ? 100 : 56, textAlign: 'center' }]}>{format(value)}</T>
          </Press>
        )}
        <Press onPress={() => onChange(clamp(value + step))} style={styles.step} hitSlop={6} label={`More ${label ?? ''}`}><Icon name="plus" size={16} /></Press>
      </Row>
    </View>
  );
}

export const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline, gap: space.md },
  button: { height: 52, borderRadius: radius.pill, paddingHorizontal: space.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  small: { height: 40, paddingHorizontal: space.lg },
  segment: { flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: radius.pill, padding: 3, height: 38 },
  pill: { position: 'absolute', top: 3, bottom: 3, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.18)' },
  segmentItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, height: 32, borderRadius: radius.pill, backgroundColor: colors.surface2, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.cyanSoft, alignItems: 'center', justifyContent: 'center' },
  step: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface3, alignItems: 'center', justifyContent: 'center' },
});

/** Page dots: the current page's dot stretches into a pill. */
export function PageDots({ count, index, color = colors.text }: { count: number; index: number; color?: string }) {
  return (
    <Row gap={6} style={{ justifyContent: 'center' }}>
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={[{
            height: 6, borderRadius: 3, width: i === index ? 18 : 6, backgroundColor: i === index ? color : alpha(color, 0.25),
            transitionProperty: ['width', 'backgroundColor'], transitionDuration: 260, transitionTimingFunction: UI_EASE,
          } as any]}
        />
      ))}
    </Row>
  );
}

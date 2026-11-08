// What an exercise works, at the top of it in a workout, beside its picture: the body lit by level
// (brightest where it leads), cut down to where the work is. Swipe it, or tap it, to turn between the
// front and the back. Hold it to open the detail: a panel grown out of the body itself with the
// movement, the whole body front and back (what leads lights first, then what works hard, then what
// helps) and every part named with its level; picking one makes it pulse on the body. Drag down, tap
// outside or the cross to close: it shrinks back into its place. With Reduce Motion it only fades.
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { Easing, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming, Extrapolation } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { anatomy, PART_NAMES, type Anatomy, type Part } from '../domain/anatomy';
import type { Level } from '../domain/backFocus';
import type { Exercise } from '../domain/types';
import { useStore } from '../store';
import { alpha, colors, radius, space } from '../theme';
import { AnatomyBody, focusBox, SHADES } from './AnatomyBody';
import { ExerciseImage } from './ExerciseImage';
import { Icon } from './Icon';
import { Press, Row, T } from './ui';

const LEVEL_NAMES: Record<Level, string> = { 3: 'Leads', 2: 'Works hard', 1: 'Helps' };
const FOOT = 20; // the page dots and the side's name under the body
type Rect = { x: number; y: number; w: number; h: number };
const VIEW_OF = ['front', 'rear'] as const;

/** The body beside the exercise picture: swipe or tap for front and back, hold for the detail. */
export function MusclePanel({ e, attachment, width, height }: { e: Exercise; attachment?: string; width: number; height: number }) {
  const sex = useStore((s) => s.profile.sex) === 'female' ? 'female' : 'male';
  const a = useMemo(() => anatomy(e, attachment), [e, attachment]);
  const anchor = useRef<View>(null);
  const pager = useRef<ScrollView>(null);
  const [from, setFrom] = useState<Rect | null>(null);
  const bodyH = height - FOOT - space.sm;
  const boxes = useMemo(() => (a ? VIEW_OF.map((v) => focusBox(a.parts, sex, width / bodyH, v)) : null), [a, sex, width, bodyH]);
  const first = a ? (focusBox(a.parts, sex).view === 'rear' ? 1 : 0) : 0;
  const [page, setPage] = useState(first);
  // Open on the side where the work is (contentOffset alone is iOS-only).
  useEffect(() => {
    const id = requestAnimationFrame(() => pager.current?.scrollTo({ x: first * width, animated: false }));
    return () => cancelAnimationFrame(id);
  }, [first, width]);
  if (!a || !boxes) return null;
  const lead = a.parts.filter(([, l]) => l === 3).map(([p]) => PART_NAMES[p]);
  const flip = () => { const next = page ? 0 : 1; pager.current?.scrollTo({ x: next * width, animated: true }); setPage(next); };
  const open = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    anchor.current?.measureInWindow((x, y, w, h) => setFrom({ x, y, w, h }));
  };
  return (
    <>
    <View ref={anchor} collapsable={false} style={[styles.panelBox, { width, height, opacity: from ? 0 : 1 }]}>
      <ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        contentOffset={{ x: first * width, y: 0 }}
        onMomentumScrollEnd={(ev) => setPage(Math.round(ev.nativeEvent.contentOffset.x / width))}
        onScroll={(ev) => { const p = Math.round(ev.nativeEvent.contentOffset.x / width); if (p !== page) setPage(p); }}
        scrollEventThrottle={64}
        style={{ flexGrow: 0 }}>
        {boxes.map((b, i) => (
          <Pressable
            key={i}
            onPress={flip}
            onLongPress={open}
            delayLongPress={320}
            accessibilityRole="button"
            accessibilityLabel={`Muscles worked, ${i ? 'back' : 'front'}: ${lead.join(', ')}. Tap to turn, hold for the detail`}
            style={{ width, height: bodyH + space.sm, paddingTop: space.sm }}>
            <AnatomyBody parts={a.parts} sex={sex} box={b.box} width={width} height={bodyH} reveal={e.id + (attachment ?? '')} />
          </Pressable>
        ))}
      </ScrollView>
      <Row gap={5} style={{ height: FOOT, justifyContent: 'center' }}>
        {[0, 1].map((i) => <View key={i} style={{ width: i === page ? 12 : 5, height: 5, borderRadius: 3, backgroundColor: i === page ? colors.cyan : colors.surface3 }} />)}
        <T v="footnote" color={colors.faint} style={{ fontSize: 11, marginLeft: 4 }}>{page ? 'Back' : 'Front'} · hold for detail</T>
      </Row>
    </View>
    {from && <MuscleSheet e={e} a={a} sex={sex} from={from} onClose={() => setFrom(null)} />}
    </>
  );
}

function Bars({ n }: { n: Level }) {
  return (
    <Row gap={3}>
      {([1, 2, 3] as const).map((i) => <View key={i} style={{ width: 16, height: 5, borderRadius: 3, backgroundColor: i <= n ? SHADES[n] : colors.surface3 }} />)}
    </Row>
  );
}

/** The body front and back lit by level, the levels' key, and every part with its level; tap one to find it. */
export function MuscleDetail({ a, sex, width }: { a: Anatomy; sex: 'male' | 'female'; width: number }) {
  const [selected, setSelected] = useState<Part | null>(null);
  const levels = ([3, 2, 1] as Level[]).filter((l) => a.parts.some(([, x]) => x === l));
  return (
    <View style={{ gap: space.md }}>
      <View style={{ alignItems: 'center' }}>
        <AnatomyBody parts={a.parts} sex={sex} view="both" width={width} reveal="open" selected={selected} />
        <View style={styles.views} pointerEvents="none">
          <T v="caption" color={colors.faint}>Front</T>
          <T v="caption" color={colors.faint}>Back</T>
        </View>
      </View>
      <Row gap={space.md} style={{ justifyContent: 'center' }}>
        {([3, 2, 1] as Level[]).map((l) => (
          <Row key={l} gap={6}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: SHADES[l] }} />
            <T v="footnote" color={colors.dim}>{LEVEL_NAMES[l]}</T>
          </Row>
        ))}
      </Row>
      {levels.map((l) => (
        <View key={l} style={{ gap: 2 }}>
          <T v="caption" color={colors.faint}>{LEVEL_NAMES[l]}</T>
          {a.parts.filter(([, x]) => x === l).map(([part]) => {
            const on = selected === part;
            return (
              <Press key={part} haptic={false} onPress={() => setSelected(on ? null : part)} label={`${PART_NAMES[part]}: ${LEVEL_NAMES[l]}`}>
                <Row style={[styles.part, on && { backgroundColor: alpha(colors.lime, 0.1) }]}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: on ? colors.lime : SHADES[l] }} />
                  <T v="label" color={on ? colors.text : l === 3 ? colors.text : colors.dim} style={{ flex: 1 }}>{PART_NAMES[part]}</T>
                  <Bars n={l} />
                </Row>
              </Press>
            );
          })}
        </View>
      ))}
      <T v="footnote" color={colors.faint}>
        {a.source ? `${a.source}. ` : ''}Tap a muscle to find it on the body. Shades show how much each part works, an estimate from the exercise’s muscles{a.source ? ' and the studies named' : ''}.
      </T>
    </View>
  );
}

function MuscleSheet({ e, a, sex, from, onClose }: { e: Exercise; a: Anatomy; sex: 'male' | 'female'; from: Rect; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const reduced = useReducedMotion();
  const panelW = Math.min(W - space.lg * 2, 460);
  const left = (W - panelW) / 2;
  const top = insets.top + space.xl;
  const maxH = H - top - insets.bottom - space.lg;
  const bodyW = panelW - space.lg * 2;

  const k = useSharedValue(0); // 0 in the tile, 1 open
  const drag = useSharedValue(0);
  const panelH = useSharedValue(0);
  const started = useRef(false);

  const close = () => {
    k.set(withTiming(0, { duration: reduced ? 160 : 280, easing: Easing.bezier(0.32, 0.72, 0, 1) }, (done) => { if (done) scheduleOnRN(onClose); }));
  };
  const pan = Gesture.Pan()
    .onUpdate((ev) => { drag.set(ev.translationY > 0 ? ev.translationY : ev.translationY * 0.15); })
    .onEnd((ev) => {
      if (ev.translationY > 110 || ev.velocityY > 900) scheduleOnRN(close);
      else drag.set(withSpring(0, { dampingRatio: 1, duration: 350 }));
    });

  const panel = useAnimatedStyle(() => {
    const p = k.get();
    if (reduced) return { opacity: p, transform: [{ translateY: drag.get() }] };
    const h = panelH.get() || 1;
    const s0 = from.w / panelW;
    const dx = from.x + from.w / 2 - (left + panelW / 2);
    const dy = from.y + from.h / 2 - (top + h / 2);
    return {
      opacity: interpolate(p, [0, 0.25], [0, 1], Extrapolation.CLAMP),
      transform: [{ translateX: dx * (1 - p) }, { translateY: dy * (1 - p) + drag.get() * p }, { scale: s0 + (1 - s0) * p }],
    };
  });
  const scrim = useAnimatedStyle(() => ({ opacity: k.get() * interpolate(drag.get(), [0, 400], [1, 0.4], Extrapolation.CLAMP) }));

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent onRequestClose={close}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.72)' }, scrim]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" />
        </Animated.View>
        <Animated.View
          onLayout={(ev) => {
            panelH.set(ev.nativeEvent.layout.height);
            if (started.current) return;
            started.current = true;
            k.set(reduced ? withTiming(1, { duration: 200 }) : withSpring(1, { dampingRatio: 1, duration: 460 }));
          }}
          style={[styles.panel, { left, top, width: panelW, maxHeight: maxH }, panel]}>
          <GestureDetector gesture={pan}>
            <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm, gap: space.md }}>
              <View style={styles.grabber} />
              <Row gap={space.md} style={{ alignItems: 'flex-start' }}>
                <ExerciseImage exercise={e} thumb style={styles.thumb} />
                <View style={{ flex: 1, gap: 2 }}>
                  <T v="headline" numberOfLines={2}>{e.name}</T>
                  {a.note && <T v="footnote" color={colors.dim}>{a.note}</T>}
                </View>
                <Press onPress={close} style={styles.close} label="Close"><Icon name="xmark" size={13} /></Press>
              </Row>
            </View>
          </GestureDetector>
          <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: space.md }} showsVerticalScrollIndicator={false}>
            <MuscleDetail a={a} sex={sex} width={bodyW} />
          </ScrollView>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  panelBox: { borderRadius: radius.md, backgroundColor: colors.surface, overflow: 'hidden' },
  panel: { position: 'absolute', borderRadius: radius.xl, backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.hairlineStrong, overflow: 'hidden' },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: colors.surface3 },
  thumb: { width: 60, height: 60, borderRadius: radius.sm, overflow: 'hidden' },
  close: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  views: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', justifyContent: 'space-around' },
  part: { gap: space.sm, paddingVertical: 9, paddingHorizontal: space.sm, borderRadius: radius.sm },
});

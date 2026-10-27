import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, useReducedMotion } from 'react-native-reanimated';

import { formatClock } from '../domain/intervals';
import { useStore } from '../store';
import { alpha, colors, radius, space, type } from '../theme';
import { Icon } from './Icon';
import { Press, Ring, Row, T } from './ui';

/** Docked rest countdown. The ring drains; the last countdown seconds turn lime and beep. */
export function RestBar() {
  const rest = useStore((s) => s.rest);
  const countdown = useStore((s) => s.timer.countdown);
  const reduced = useReducedMotion();
  const [, force] = useState(0);
  const active = rest.endsAt !== null || rest.paused !== null;

  useEffect(() => {
    if (!rest.endsAt) return;
    const id = setInterval(() => force((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [rest.endsAt]);

  if (!active) return null;
  const remaining = rest.endsAt ? Math.max(0, (rest.endsAt - Date.now()) / 1000) : (rest.paused ?? 0) / 1000;
  const final = countdown > 0 && remaining <= countdown;
  const color = final ? colors.lime : colors.cyan;
  const { pauseRest, resumeRest, addRest, stopRest } = useStore.getState();

  return (
    <Animated.View entering={reduced ? undefined : FadeInDown.duration(220)} exiting={reduced ? undefined : FadeOutDown.duration(160)} style={styles.bar}>
      <Ring size={54} stroke={5} progress={rest.total ? remaining / rest.total : 0} color={color}>
        <Icon name="timer" size={16} color={color} />
      </Ring>
      <View style={{ flex: 1 }}>
        <T v="caption" color={colors.faint}>{rest.paused !== null ? 'Paused' : 'Rest'}</T>
        <T v="big" color={color} style={[type.num, { fontSize: 30 }]}>{formatClock(remaining)}</T>
      </View>
      <Row gap={6}>
        <Press onPress={() => addRest(-15)} style={styles.btn}><T v="label" style={{ fontWeight: '700' }}>−15</T></Press>
        <Press onPress={() => addRest(15)} style={styles.btn}><T v="label" style={{ fontWeight: '700' }}>+15</T></Press>
        <Press onPress={() => (rest.paused !== null ? resumeRest() : pauseRest())} style={styles.btn}>
          <Icon name={rest.paused !== null ? 'play.fill' : 'pause.fill'} size={15} />
        </Press>
        <Press onPress={stopRest} label="Skip rest" style={[styles.btn, { backgroundColor: alpha(colors.cyan, 0.16) }]}>
          <Icon name="forward.fill" size={15} color={colors.cyan} />
        </Press>
      </Row>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, paddingRight: space.md,
    borderRadius: radius.xl, backgroundColor: colors.surface2, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.hairlineStrong,
  },
  btn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface3, alignItems: 'center', justifyContent: 'center' },
});

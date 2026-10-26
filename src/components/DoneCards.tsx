import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';

import { cardioKcal, formatClock, pace } from '../domain/intervals';
import type { CardioSession } from '../domain/types';
import { latestWeight, today, useStore } from '../store';
import { alpha, colors, plural, space } from '../theme';
import { ACTIVITY_ICON } from './CardioPlanCard';
import { menu } from './holdMenu';
import { Icon } from './Icon';
import { Figure, Head, Pill, Shell } from './WorkoutCard';
import { Row } from './ui';

/** A finished cardio session in the same card as a workout: its numbers, how it was built; hold to edit. */
export function DoneCardioCard({ c }: { c: CardioSession }) {
  const router = useRouter();
  const weight = useStore(latestWeight);
  const kcal = cardioKcal(c.activity, c.minutes, weight);
  const p = pace(c.minutes, c.distanceKm);
  const open = () => menu([
    { label: 'Edit time, distance or effort', go: () => router.push({ pathname: '/cardio-edit', params: { id: c.id } }) },
  ]);
  const hold = Gesture.LongPress().minDuration(450).onStart(() => scheduleOnRN(open));
  return (
    <GestureDetector gesture={hold}>
      <View>
        <Shell done>
          <Row style={{ alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Head label={`✓ ${c.date === today() ? 'Completed today' : 'Completed'}`} title={c.name ?? c.activity} sub={`${c.activity} · hold to edit`} tint={colors.lime} />
            </View>
            <View style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(colors.lime, 0.14) }}>
              <Icon name={ACTIVITY_ICON[c.activity] ?? 'figure.run'} size={22} color={colors.lime} />
            </View>
          </Row>
          <Row style={{ paddingVertical: space.md, borderRadius: 14, backgroundColor: alpha('#FFFFFF', 0.035) }}>
            <Figure label="Time" value={`${c.minutes}`} unit="min" />
            {c.distanceKm ? <Figure label="Distance" value={c.distanceKm.toFixed(2)} unit="km" /> : null}
            {p ? <Figure label="Pace" value={p.replace(' /km', '')} unit="/km" /> : null}
            {kcal ? <Figure label="Energy" value={`${kcal}`} unit="kcal" /> : null}
          </Row>
          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            {c.rpe ? <Pill text={`Effort ${c.rpe}/10`} strong /> : null}
            {c.avgHr ? <Pill text={`${c.avgHr} bpm`} /> : null}
            {c.plan && c.plan.rounds > 1 ? <Pill text={`${plural(c.plan.rounds, 'round')} · ${formatClock(c.plan.workSeconds)} on${c.plan.recoverySeconds ? ` / ${formatClock(c.plan.recoverySeconds)} off` : ''}`} /> : null}
          </Row>
        </Shell>
      </View>
    </GestureDetector>
  );
}

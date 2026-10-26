import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { ActionSheetIOS, Platform, View } from 'react-native';

import { exercise } from '../catalog';
import { groupByExercise, personalRecords, sessionMinutes, totalLoad, volumeLoad, working } from '../domain/calc';
import { cardioKcal, formatClock, pace } from '../domain/intervals';
import { formatWeight, toDisplay } from '../domain/plates';
import type { CardioSession, Session } from '../domain/types';
import { latestWeight, today, useStore } from '../store';
import { alpha, colors, space, type } from '../theme';
import { ACTIVITY_ICON } from './CardioPlanCard';
import { Icon, type IconName } from './Icon';
import { Card, Row, Stat, T } from './ui';

/** Holding a finished card: a short menu, or straight to the first choice off iOS. */
function menu(options: { label: string; go: () => void }[]) {
  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  if (Platform.OS !== 'ios' || options.length === 1) return options[0].go();
  ActionSheetIOS.showActionSheetWithOptions({ options: [...options.map((o) => o.label), 'Cancel'], cancelButtonIndex: options.length }, (i) => options[i]?.go());
}

function Header({ icon, title, date }: { icon: IconName; title: string; date: string }) {
  return (
    <Row>
      <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(colors.lime, 0.16) }}>
        <Icon name={icon} size={18} color={colors.lime} />
      </View>
      <View style={{ flex: 1 }}>
        <T v="caption" color={colors.lime}>{date === today() ? 'Completed today' : 'Completed'}</T>
        <T v="title3" numberOfLines={2}>{title}</T>
      </View>
      <T v="caption" color={colors.faint} style={{ textTransform: 'none', letterSpacing: 0 }}>Hold to edit</T>
    </Row>
  );
}

/** Where Start would be: the mark that it is done. */
function Done() {
  return (
    <Row gap={6} style={{ justifyContent: 'center', height: 44, borderRadius: 22, backgroundColor: alpha(colors.lime, 0.14) }}>
      <Icon name="checkmark.circle.fill" size={16} color={colors.lime} />
      <T v="headline" color={colors.lime}>Completed</T>
    </Row>
  );
}

/** A workout finished today: time, sets, volume, records, and each exercise's best set with its record. */
export function DoneWorkoutCard({ x }: { x: Session }) {
  const router = useRouter();
  const sessions = useStore((s) => s.sessions);
  const unit = useStore((s) => s.profile.unit);
  const records = personalRecords(sessions, x);
  const groups = groupByExercise(working(x.sets)).filter((g) => g.sets.some((y) => y.reps > 0));
  const minutes = sessionMinutes(x);
  const open = () => menu([
    { label: 'Edit sets', go: () => router.push({ pathname: '/session/[id]', params: { id: x.id, edit: '1' } }) },
    { label: 'See the workout', go: () => router.push({ pathname: '/session/[id]', params: { id: x.id } }) },
  ]);
  return (
    <Card onLongPress={open} style={{ borderColor: alpha(colors.lime, 0.35) }}>
      <Header icon="dumbbell.fill" title={x.name} date={x.date} />
      <Row style={{ justifyContent: 'space-between' }}>
        <Stat small label="Time" value={minutes ? Math.round(minutes) : '—'} unit={minutes ? 'min' : undefined} />
        <Stat small label="Sets" value={working(x.sets).length} />
        <Stat small label="Volume" value={Math.round(toDisplay(volumeLoad(x.sets), unit)).toLocaleString()} unit={unit} />
        <Stat small label="Records" value={records.length} color={records.length ? colors.lime : undefined} />
      </Row>
      <View style={{ gap: 6 }}>
        {groups.slice(0, 7).map((g) => {
          const top = g.sets.reduce((a, b) => (totalLoad(b) > totalLoad(a) || (totalLoad(b) === totalLoad(a) && b.reps > a.reps) ? b : a));
          const pr = records.find((r) => r.exerciseId === g.exerciseId);
          return (
            <Row key={g.exerciseId} gap={space.sm}>
              <T v="callout" numberOfLines={1} style={{ flex: 1 }}>{exercise(g.exerciseId)?.name ?? g.exerciseId}</T>
              {pr && (
                <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, backgroundColor: alpha(colors.lime, 0.16) }}>
                  <T v="caption" color={colors.lime}>{pr.kind === 'first' ? 'First' : 'PR'}</T>
                </View>
              )}
              <T v="footnote" color={colors.dim} style={type.num}>
                {g.sets.length} {g.sets.length === 1 ? 'set' : 'sets'} · best {top.implements === 2 ? '2×' : ''}{formatWeight(top.loadKg, unit)} {unit} × {top.reps}
              </T>
            </Row>
          );
        })}
        {groups.length > 7 && <T v="footnote" color={colors.faint}>+{groups.length - 7} more</T>}
      </View>
      <Done />
    </Card>
  );
}

/** A cardio session finished today: time, distance, pace, energy, effort. */
export function DoneCardioCard({ c }: { c: CardioSession }) {
  const router = useRouter();
  const weight = useStore(latestWeight);
  const kcal = cardioKcal(c.activity, c.minutes, weight);
  const p = pace(c.minutes, c.distanceKm);
  const open = () => menu([
    { label: 'Edit time, distance or effort', go: () => router.push({ pathname: '/cardio-edit', params: { id: c.id } }) },
  ]);
  return (
    <Card onLongPress={open} style={{ borderColor: alpha(colors.lime, 0.35) }}>
      <Header icon={ACTIVITY_ICON[c.activity] ?? 'figure.run'} title={c.name ?? c.activity} date={c.date} />
      <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap', rowGap: space.md }}>
        <Stat small label="Time" value={c.minutes} unit="min" />
        {c.distanceKm ? <Stat small label="Distance" value={c.distanceKm.toFixed(2)} unit="km" /> : null}
        {p ? <Stat small label="Pace" value={p.replace(' /km', '')} unit="/km" /> : null}
        {kcal ? <Stat small label="Energy" value={kcal} unit="kcal" /> : null}
        {c.rpe ? <Stat small label="Effort" value={`${c.rpe}/10`} /> : null}
      </Row>
      {c.plan && c.plan.rounds > 1 && (
        <T v="footnote" color={colors.dim}>{c.plan.rounds} × {formatClock(c.plan.workSeconds)} work{c.plan.recoverySeconds ? ` / ${formatClock(c.plan.recoverySeconds)} recovery` : ''}</T>
      )}
      <Done />
    </Card>
  );
}

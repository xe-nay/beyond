import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { longDate } from '../src/components/DayDetail';
import { ACTIVITY_ICON } from '../src/components/CardioPlanCard';
import { Icon, type IconName } from '../src/components/Icon';
import { Press, Row, Segmented, T } from '../src/components/ui';
import { PRESETS } from '../src/cardioPresets';
import { formatClock, totalSeconds } from '../src/domain/intervals';
import type { IntervalPlan, Prescription } from '../src/domain/types';
import { activeProgram, uid, useStore } from '../src/store';
import { alpha, colors, plural, radius, space } from '../src/theme';

interface Pick { key: string; title: string; sub: string; icon: IconName; add: () => void }

/**
 * Plans a workout or a cardio session on a day: a day of a program, a workout from your plans or history
 * (the latest of each name), a saved or recent cardio session, or a ready-made one. A planned cardio
 * session can then be changed with Edit on its card.
 */
export default function PlanDay() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const router = useRouter();
  const s = useStore();
  const [kind, setKind] = useState<'strength' | 'cardio'>('strength');

  const strength = (name: string, plan: Prescription[]) => {
    s.planOn({ session: { id: uid(), programId: null, dayId: null, name, date, plan: plan.map((x) => ({ ...x })), sets: [], startedAt: null, finishedAt: null, sessionRpe: null, notes: '', source: 'app' } });
    router.back();
  };
  const cardio = (name: string, plan: IntervalPlan) => {
    s.planOn({ cardio: { id: uid(), date, activity: plan.activity, name, plan: { ...plan }, minutes: Math.round(totalSeconds(plan) / 60), distanceKm: null, rpe: null, avgHr: null, completed: false, notes: '' } });
    router.back();
  };

  // Strength: the active program's days first, then other programs, then the latest workout of each name.
  const active = activeProgram(s);
  const programs = [...(active ? [active] : []), ...s.programs.filter((p) => p.id !== active?.id)];
  const seen = new Set<string>();
  const once = (name: string) => (seen.has(name.toLowerCase()) ? false : (seen.add(name.toLowerCase()), true));
  const sets = (plan: Prescription[]) => plural(plan.reduce((n, x) => n + x.sets, 0), 'set');
  const fromPrograms: Pick[] = programs.flatMap((p) => p.days.filter((d) => d.exercises.length && once(d.name)).map((d) => ({
    key: `${p.id}-${d.id}`, title: d.name, sub: `${p.name} · ${plural(d.exercises.length, 'exercise')} · ${sets(d.exercises)}`, icon: 'dumbbell.fill' as IconName, add: () => strength(d.name, d.exercises),
  })));
  const fromPlans: Pick[] = [...s.sessions].filter((x) => x.plan.length).sort((a, b) => b.date.localeCompare(a.date)).filter((x) => once(x.name)).slice(0, 20).map((x) => ({
    key: x.id, title: x.name, sub: `${x.finishedAt ? 'Done' : 'Planned'} ${x.date} · ${plural(x.plan.length, 'exercise')} · ${sets(x.plan)}`, icon: 'dumbbell.fill' as IconName, add: () => strength(x.name, x.plan),
  }));

  // Cardio: saved workouts, the latest planned or done session of each name, then the ready-made ones.
  const seenCardio = new Set<string>();
  const onceCardio = (name: string) => (seenCardio.has(name.toLowerCase()) ? false : (seenCardio.add(name.toLowerCase()), true));
  const cardioSub = (p: IntervalPlan) => `${p.activity} · ${formatClock(totalSeconds(p))}${p.segments?.length ? ` · ${plural(p.segments.length, 'segment')}` : p.rounds > 1 ? ` · ${p.rounds} rounds` : ''}`;
  const icon = (p: IntervalPlan) => ACTIVITY_ICON[p.activity] ?? 'figure.run';
  const saved: Pick[] = s.savedCardio.filter((x) => onceCardio(x.name)).map((x) => ({ key: x.id, title: x.name, sub: cardioSub(x.plan), icon: icon(x.plan), add: () => cardio(x.name, x.plan) }));
  const recent: Pick[] = [...s.cardio].filter((c) => c.plan).sort((a, b) => b.date.localeCompare(a.date)).filter((c) => onceCardio(c.name ?? c.activity)).slice(0, 15)
    .map((c) => ({ key: c.id, title: c.name ?? c.activity, sub: `${c.completed ? 'Done' : 'Planned'} ${c.date} · ${cardioSub(c.plan!)}`, icon: icon(c.plan!), add: () => cardio(c.name ?? c.activity, c.plan!) }));
  const ready: Pick[] = PRESETS.filter((x) => onceCardio(x.name)).map((x) => ({ key: x.name, title: x.name, sub: cardioSub(x.plan), icon: icon(x.plan), add: () => cardio(x.name, x.plan) }));

  const groups = kind === 'strength'
    ? [{ title: 'From your programs', items: fromPrograms }, { title: 'From your plans and history', items: fromPlans }]
    : [{ title: 'Saved', items: saved }, { title: 'From your plans and history', items: recent }, { title: 'Ready-made', items: ready }];
  const empty = groups.every((g) => !g.items.length);

  return (
    <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.lg }}>
      <View style={{ gap: 2 }}>
        <T v="title">Plan a workout</T>
        <T v="label" color={colors.dim}>{date ? longDate(date) : ''}</T>
      </View>
      <Segmented options={[{ value: 'strength', label: 'Strength' }, { value: 'cardio', label: 'Cardio' }]} value={kind} onChange={setKind} />
      {empty && (
        <T v="callout" color={colors.dim}>
          {kind === 'strength' ? 'No workouts yet. Pick a program under Train, or import a plan.' : 'No cardio yet.'}
        </T>
      )}
      {groups.filter((g) => g.items.length).map((g) => (
        <View key={g.title} style={{ gap: space.sm }}>
          <T v="caption" color={colors.faint}>{g.title}</T>
          {g.items.map((x) => (
            <Press key={x.key} onPress={x.add} label={`Plan ${x.title}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.hairline }}>
              <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(kind === 'cardio' ? colors.lime : colors.cyan, 0.14) }}>
                <Icon name={x.icon} size={15} color={kind === 'cardio' ? colors.lime : colors.cyan} />
              </View>
              <View style={{ flex: 1 }}>
                <T v="headline" numberOfLines={1}>{x.title}</T>
                <T v="footnote" color={colors.dim} numberOfLines={1}>{x.sub}</T>
              </View>
              <Icon name="plus" size={14} color={colors.faint} />
            </Press>
          ))}
        </View>
      ))}
      {kind === 'cardio' && <T v="footnote" color={colors.faint}>After adding it, Edit on its card changes the times, machine, segments and targets.</T>}
    </ScrollView>
  );
}

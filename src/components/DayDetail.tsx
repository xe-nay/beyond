import { useRouter } from 'expo-router';
import { View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { formatWeight } from '../domain/plates';
import { MEALS } from '../meals';
import { plannedFor } from '../schedule';
import { eatenOn, intakeNutrients, today, useStore } from '../store';
import { alpha, colors, plural, space, type } from '../theme';
import { CardioPlanCard } from './CardioPlanCard';
import { DoneCardioCard } from './DoneCards';
import { DoneWorkoutCard, Head, PlanCard, Shell } from './WorkoutCard';
import { Icon } from './Icon';
import { NutritionCard } from './NutritionCard';
import { Button, Card, Press, Row, Section, Stat, T } from './ui';

/** "Today", "Yesterday", "In 3 days", "5 days ago". */
export function relative(date: string, now = today()) {
  const days = Math.round((Date.parse(date) - Date.parse(now)) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  return days > 0 ? `In ${days} days` : `${-days} days ago`;
}

/** "Tuesday 27 October" (with the year when it is not this one). */
export const longDate = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: date.slice(0, 4) === today().slice(0, 4) ? undefined : 'numeric' });

/**
 * Everything about one day, in place: what was done (each workout with its sets and records, each
 * cardio session with its numbers), what is planned, the food and intake, weight and check-in.
 * Finished workouts and cardio are changed by holding their card.
 */
export function DayDetail({ date }: { date: string }) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const s = useStore();
  const now = today();
  const past = date < now;
  const isToday = date === now;
  const { sessions: imported, programDay, program, cardio: cardioPlanned, done, cardioDone, rest } = plannedFor(s, date, now);
  const open = isToday ? s.sessions.find((x) => x.id === s.activeSession && !x.finishedAt) : undefined;
  const entries = s.entries.filter((e) => e.date === date);
  const taken = s.intakes.filter((i) => i.date === date);
  const missed = s.supplements.filter((x) => x.createdAt.slice(0, 10) <= date && !taken.some((i) => i.supplementId === x.id)).length;
  const eaten = eatenOn(s, date);
  const body = s.body.find((b) => b.date === date);
  const check = s.checks.find((c) => c.date === date);
  const nothing = !done.length && !open && !imported.length && !programDay && !cardioDone.length && !cardioPlanned.length;

  const start = (input: { dayId?: string; sessionId?: string }) => {
    s.startSession(input);
    router.push('/workout');
  };

  return (
    <View style={{ gap: space.lg }}>
      {open && (
        <Shell>
          <Head label="● In progress" title={open.name} sub={`${plural(open.sets.filter((x) => !x.warmup).length, 'set')} logged so far`} tint={colors.cyan} />
          <Button title="Resume" icon="play.fill" onPress={() => router.push('/workout')} />
        </Shell>
      )}
      {done.map((x, i) => (
        <Animated.View key={x.id} entering={reduced ? undefined : FadeInDown.delay(i * 60).duration(280)}>
          <DoneWorkoutCard x={x} />
        </Animated.View>
      ))}
      {cardioDone.map((c) => <DoneCardioCard key={c.id} c={c} />)}
      {imported.map((x) => (
        <PlanCard key={x.id} title={x.name} label={isToday ? 'Planned today' : 'Planned'} plan={x.plan} notes={x.notes} unit={s.profile.unit} onStart={isToday && !open ? () => start({ sessionId: x.id }) : undefined} />
      ))}
      {programDay && (
        <PlanCard title={programDay.name} label={`${program!.name}${isToday ? ' · today' : ''}`} plan={programDay.exercises} unit={s.profile.unit} onStart={isToday && !open ? () => start({ dayId: programDay.id }) : undefined} />
      )}
      {cardioPlanned.map((c) => <CardioPlanCard key={c.id} c={c} canStart={isToday && !s.cardioRun} />)}

      {nothing && (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Icon name="bed.double.fill" size={22} color={colors.dim} />
          <View style={{ flex: 1 }}>
            <T v="headline">{past || rest ? 'Rest day' : 'Nothing planned'}</T>
            {rest && <T v="footnote" color={colors.dim}>A rest day in your plan</T>}
          </View>
        </Card>
      )}

      {/* Food and intake, for days that have happened */}
      {(past || isToday) && (
        <>
          <Section title="Nutrition" action={<Press onPress={() => router.navigate({ pathname: '/(tabs)/food', params: { date } })} haptic={false}><T v="label" color={colors.cyan}>Edit food</T></Press>}>
            <NutritionCard n={eaten} targets={s.targets} />
            {entries.length > 0 || taken.length > 0 ? (
              <Card style={{ gap: space.sm }}>
                {MEALS.map((m) => {
                  const list = entries.filter((e) => e.meal === m.value);
                  if (!list.length) return null;
                  return (
                    <View key={m.value} style={{ gap: 4 }}>
                      <Row style={{ justifyContent: 'space-between' }}>
                        <T v="caption" color={colors.faint}>{m.label}</T>
                        <T v="footnote" color={colors.dim} style={type.num}>{list.reduce((n, e) => n + e.nutrients.kcal, 0)} kcal</T>
                      </Row>
                      {list.map((e) => (
                        <Press key={e.id} haptic={false} onPress={() => router.push({ pathname: '/food/[id]', params: { id: e.foodId, entry: e.id } })}>
                          <Row style={{ justifyContent: 'space-between' }}>
                            <T v="callout" numberOfLines={1} style={{ flex: 1 }}>{e.name}</T>
                            <T v="footnote" color={colors.faint} style={type.num}>{e.time ? `${e.time} · ` : ''}{Math.round(e.amount)} {e.basis} · {e.nutrients.kcal}</T>
                          </Row>
                        </Press>
                      ))}
                    </View>
                  );
                })}
                {/* Supplements ticked that day, as one more group of the table */}
                {taken.length > 0 && (
                  <View style={{ gap: 4 }}>
                    <Row style={{ justifyContent: 'space-between' }}>
                      <T v="caption" color={colors.faint}>Daily intake</T>
                      <T v="footnote" color={colors.dim} style={type.num}>{taken.length}/{taken.length + missed}</T>
                    </Row>
                    {taken.map((i) => {
                      const kcal = intakeNutrients(s, i)?.kcal ?? 0;
                      return (
                        <Row key={i.id} style={{ justifyContent: 'space-between' }}>
                          <T v="callout" numberOfLines={1} style={{ flex: 1 }}>{i.name}</T>
                          <T v="footnote" color={colors.faint} style={type.num}>{new Date(i.takenAt).toTimeString().slice(0, 5)} · {i.dose}{kcal ? ` · ${kcal}` : ''}</T>
                        </Row>
                      );
                    })}
                  </View>
                )}
              </Card>
            ) : (
              <T v="footnote" color={colors.faint}>No food logged.</T>
            )}
          </Section>
          {(body?.weightKg || check) && (
            <Card>
              <Row style={{ justifyContent: 'space-between' }}>
                {body?.weightKg ? <Stat small label="Weight" value={formatWeight(body.weightKg, s.profile.unit)} unit={s.profile.unit} /> : null}
                {check ? <Stat small label="Sleep" value={check.sleepHours} unit="h" /> : null}
                {check ? <Stat small label="Energy" value={`${check.energy}/5`} /> : null}
              </Row>
            </Card>
          )}
        </>
      )}
    </View>
  );
}

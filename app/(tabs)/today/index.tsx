import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { View } from 'react-native';

import { exercise } from '../../../src/catalog';
import { CardioPlanCard } from '../../../src/components/CardioPlanCard';
import { DayDetail, longDate, PlanCard, relative } from '../../../src/components/DayDetail';
import { Bell } from '../../../src/components/Bell';
import { DayFlash, shortDate } from '../../../src/components/DayFlash';
import { DoneCardioCard, DoneWorkoutCard } from '../../../src/components/DoneCards';
import { Icon } from '../../../src/components/Icon';
import { WeekCalendar } from '../../../src/components/WeekCalendar';
import { Button, Card, Press, Ring, Row, Screen, Section, T } from '../../../src/components/ui';
import { fatigueReport, progression, weekStart } from '../../../src/domain/calc';
import { plannedFor } from '../../../src/schedule';
import { eatenOn, today, useStore } from '../../../src/store';
import { alpha, colors, plural, space, type } from '../../../src/theme';
import { useDaySwipe } from '../../../src/useDaySwipe';

export default function Today() {
  const router = useRouter();
  const s = useStore();
  const date = today();
  // The day shown: today, or one picked in the calendar or reached by swiping.
  const [sel, setSel] = useState(date);
  const step = (n: 1 | -1) => setSel((d) => { const x = new Date(`${d}T12:00:00`); x.setDate(x.getDate() + n); return today(x); });
  const { gesture: swipe, style: slide } = useDaySwipe(step);
  const done = s.sessions.filter((x) => x.finishedAt);
  const open = s.sessions.find((x) => x.id === s.activeSession && !x.finishedAt);

  // Only today: what is planned for today, or what was done today. Other days live in the calendar.
  const plan = plannedFor(s, date, date);
  const planned = plan.sessions[0];
  const todays = planned ? { name: planned.name, exercises: planned.plan, label: 'Planned today' } : plan.programDay ? { name: plan.programDay.name, exercises: plan.programDay.exercises, label: 'Today' } : null;
  const monday = weekStart();
  const eaten = eatenOn(s, date);
  const fatigue = fatigueReport(done, s.checks);
  const advice = todays?.exercises[0] ? progression(done, todays.exercises[0]) : null;
  const cardioWeek = s.cardio.filter((c) => c.completed && Date.parse(c.date) >= monday.getTime()).reduce((n, c) => n + c.minutes, 0);
  const cardioToday = plan.cardio[0];
  const doneToday = plan.done;
  const tone = fatigue.status === 'Ease off' ? colors.amber : fatigue.status === 'Watch' ? colors.amber : fatigue.status === 'Ready' ? colors.lime : colors.dim;

  return (
    <View style={{ flex: 1 }}>
    <Screen>
        <Stack.Screen options={{ title: sel === date ? 'Today' : shortDate(sel), headerRight: () => <Bell /> }} />
        <T v="title" color={colors.dim} style={{ fontWeight: '500', marginTop: -space.sm }}>
          {greeting()}{s.profile.name ? `, ${s.profile.name}` : ''}
        </T>

        <WeekCalendar selected={sel} onSelect={setSel} />

        {/* Swipe sideways for the day before or after; every day shows in full right here. */}
        <GestureDetector gesture={swipe}>
        <Animated.View style={[{ gap: space.lg }, slide]}>
        {sel !== date ? (
          <>
            <View style={{ gap: 2 }}>
              <T v="caption" color={colors.amber}>{relative(sel, date)}</T>
              <T v="title">{longDate(sel)}</T>
            </View>
            <DayDetail date={sel} />
          </>
        ) : (
        <>

        {/* Today's training: under way, done (with Completed instead of Start), then still planned */}
        {open && (
          <Card style={{ borderColor: alpha(colors.cyan, 0.4) }} onPress={() => router.push('/workout')}>
            <T v="caption" color={colors.cyan}>In progress</T>
            <T v="title" numberOfLines={2}>{open.name}</T>
            <T v="label" color={colors.dim}>{plural(open.sets.filter((x) => !x.warmup).length, 'set')} logged</T>
            <Button title="Resume" icon="play.fill" onPress={() => router.push('/workout')} />
          </Card>
        )}
        {doneToday.map((x) => <DoneWorkoutCard key={x.id} x={x} />)}
        {plan.cardioDone.map((c) => <DoneCardioCard key={c.id} c={c} />)}
        {todays && !open && (
          <PlanCard title={todays.name} label={todays.label} plan={todays.exercises} notes={planned?.notes} unit={s.profile.unit} onStart={() => {
            s.startSession(planned ? { sessionId: planned.id } : { dayId: plan.programDay!.id });
            router.push('/workout');
          }} />
        )}
        {!open && !todays && !doneToday.length && !plan.cardioDone.length && !cardioToday && (!plan.program && !s.sessions.some((x) => x.source === 'import') ? (
          <Card>
            <T v="title">No program yet</T>
            <Button title="Choose a program" onPress={() => router.push('/templates')} />
          </Card>
        ) : (
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <Icon name="bed.double.fill" size={22} color={colors.dim} />
            <View style={{ flex: 1 }}>
              <T v="headline">Rest day</T>
              <T v="footnote" color={colors.dim}>Nothing planned today. Tap a day above to see what is next.</T>
            </View>
          </Card>
        ))}
        {cardioToday && <CardioPlanCard c={cardioToday} canStart={!s.cardioRun} />}

        {/* Fuel */}
        <Card onPress={() => router.navigate('/(tabs)/food')}>
          <Row style={{ justifyContent: 'space-around' }}>
            <RingStat value={eaten.kcal} target={s.targets.kcal} label="kcal" color={colors.cyan} />
            <RingStat value={Math.round(eaten.protein)} target={s.targets.protein} label="protein" color={colors.lime} />
            <RingStat value={Math.round(eaten.carbs)} target={s.targets.carbs} label="carbs" color={colors.steel} />
          </Row>
        </Card>

        <Row style={{ alignItems: 'stretch' }}>
          <Card style={{ flex: 1 }} onPress={() => router.push('/check-in')}>
            <Icon name="gauge.with.dots.needle.67percent" color={tone} size={22} />
            <View style={{ gap: 2 }}>
              <T v="caption" color={colors.faint}>Readiness</T>
              <T v="headline" color={tone}>{fatigue.status}</T>
              <T v="label" color={colors.dim} numberOfLines={2}>{fatigue.signals[0]?.label ?? (s.checks.some((c) => c.date === date) ? 'Checked in' : 'Tap to check in')}</T>
            </View>
          </Card>
          <Card style={{ flex: 1 }} onPress={() => router.push('/cardio')}>
            <Icon name="figure.run" color={colors.cyan} size={22} />
            <View style={{ gap: 2 }}>
              <T v="caption" color={colors.faint}>Cardio</T>
              <T v="headline">{cardioWeek} min</T>
              <T v="label" color={colors.dim} numberOfLines={2}>{cardioToday ? `${cardioToday.activity} planned` : 'This week'}</T>
            </View>
          </Card>
        </Row>

        {advice && todays && !doneToday.length && (
          <Section title="Coach">
            <Card>
              <Row style={{ alignItems: 'flex-start' }}>
                <Icon name={advice.kind === 'increase' ? 'arrow.up.right' : advice.kind === 'reduce' ? 'arrow.down.right' : 'wand.and.stars'} color={advice.kind === 'increase' ? colors.lime : colors.cyan} size={20} />
                <View style={{ flex: 1, gap: 4 }}>
                  <T v="headline">{exercise(todays.exercises[0].exerciseId)?.name}: {advice.title}</T>
                  <T v="label" color={colors.dim}>{advice.basis}</T>
                </View>
              </Row>
            </Card>
          </Section>
        )}
        </>
        )}
        </Animated.View>
        </GestureDetector>
    </Screen>
    <DayFlash date={sel} />
    </View>
  );
}

function RingStat({ value, target, label, color }: { value: number; target: number; label: string; color: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <Ring size={84} stroke={7} progress={target ? value / target : 0} color={color}>
        <T v="headline" style={type.num}>{value}</T>
      </Ring>
      <T v="caption" color={colors.faint}>{label} / {target}</T>
    </View>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Late night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

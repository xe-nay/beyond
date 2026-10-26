import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { byId, exercise } from '../../../src/catalog';
import { BodyMap } from '../../../src/components/BodyMap';
import { CardioPlanCard } from '../../../src/components/CardioPlanCard';
import { Icon } from '../../../src/components/Icon';
import { WeekCalendar } from '../../../src/components/WeekCalendar';
import { Button, Card, Ring, Row, Screen, Section, Stat, T } from '../../../src/components/ui';
import { fatigueReport, personalRecords, progression, volumeLoad, weekStart, working } from '../../../src/domain/calc';
import { toDisplay } from '../../../src/domain/plates';
import { plannedFor } from '../../../src/schedule';
import type { Region } from '../../../src/domain/types';
import { eatenOn, today, useStore } from '../../../src/store';
import { alpha, colors, plural, space, type } from '../../../src/theme';

export default function Today() {
  const router = useRouter();
  const s = useStore();
  const date = today();
  const done = s.sessions.filter((x) => x.finishedAt);
  const open = s.sessions.find((x) => x.id === s.activeSession && !x.finishedAt);

  // Only today: what is planned for today, or what was done today. Other days live in the calendar.
  const plan = plannedFor(s, date, date);
  const planned = plan.sessions[0];
  const todays = planned ? { name: planned.name, exercises: planned.plan, label: 'Planned today' } : plan.programDay ? { name: plan.programDay.name, exercises: plan.programDay.exercises, label: 'Today' } : null;
  const regions = useMemo(() => [...new Set(todays?.exercises.flatMap((x) => byId[x.exerciseId]?.primary ?? []) ?? [])] as Region[], [todays?.name, todays?.exercises.length]);
  const monday = weekStart();
  const eaten = eatenOn(s, date);
  const fatigue = fatigueReport(done, s.checks);
  const advice = todays?.exercises[0] ? progression(done, todays.exercises[0]) : null;
  const cardioWeek = s.cardio.filter((c) => c.completed && Date.parse(c.date) >= monday.getTime()).reduce((n, c) => n + c.minutes, 0);
  const cardioToday = plan.cardio[0];
  const doneToday = plan.done;
  const tone = fatigue.status === 'Ease off' ? colors.amber : fatigue.status === 'Watch' ? colors.amber : fatigue.status === 'Ready' ? colors.lime : colors.dim;

  return (
    <Screen>
        <T v="title" color={colors.dim} style={{ fontWeight: '500', marginTop: -space.sm }}>
          {greeting()}{s.profile.name ? `, ${s.profile.name}` : ''}
        </T>

        <WeekCalendar />

        {/* Today's training */}
        {open ? (
          <Card style={{ borderColor: alpha(colors.cyan, 0.4) }} onPress={() => router.push('/workout')}>
            <T v="caption" color={colors.cyan}>In progress</T>
            <T v="title" numberOfLines={2}>{open.name}</T>
            <T v="label" color={colors.dim}>{plural(open.sets.filter((x) => !x.warmup).length, 'set')} logged</T>
            <Button title="Resume" icon="play.fill" onPress={() => router.push('/workout')} />
          </Card>
        ) : doneToday.length ? (
          <Card onPress={() => router.push(`/day/${date}`)} style={{ borderColor: alpha(colors.lime, 0.35) }}>
            <Row>
              <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(colors.lime, 0.16) }}>
                <Icon name="checkmark" size={18} color={colors.lime} />
              </View>
              <View style={{ flex: 1 }}>
                <T v="caption" color={colors.lime}>Done today</T>
                <T v="title" numberOfLines={2}>{doneToday.map((x) => x.name).join(' + ')}</T>
              </View>
              <Icon name="chevron.right" size={14} color={colors.faint} />
            </Row>
            <Row style={{ justifyContent: 'space-between' }}>
              <Stat small label="Sets" value={doneToday.reduce((n, x) => n + working(x.sets).length, 0)} />
              <Stat small label="Volume" value={Math.round(toDisplay(doneToday.reduce((n, x) => n + volumeLoad(x.sets), 0), s.profile.unit)).toLocaleString()} unit={s.profile.unit} />
              <Stat small label="Records" value={doneToday.reduce((n, x) => n + personalRecords(s.sessions, x).length, 0)} color={colors.lime} />
            </Row>
          </Card>
        ) : todays ? (
          <Card>
            <Row style={{ alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: 6 }}>
                <T v="caption" color={colors.faint}>{todays.label}</T>
                <T v="title" numberOfLines={2}>{todays.name}</T>
                <T v="label" color={colors.dim}>{plural(todays.exercises.length, 'exercise')} · {plural(todays.exercises.reduce((n, x) => n + x.sets, 0), 'set')}</T>
                <View style={{ gap: 4, marginTop: 6 }}>
                  {todays.exercises.slice(0, 4).map((x, i) => (
                    <T key={i} v="label" color={colors.dim} numberOfLines={1}>{exercise(x.exerciseId)?.name}</T>
                  ))}
                </View>
              </View>
              <View style={{ marginRight: -space.md, marginTop: -space.sm }}>
                <BodyMap key={todays.name} primary={regions} scale={0.42} toggle={false} />
              </View>
            </Row>
            <Button title="Start workout" icon="play.fill" onPress={() => {
              s.startSession(planned ? { sessionId: planned.id } : { dayId: plan.programDay!.id });
              router.push('/workout');
            }} />
          </Card>
        ) : !plan.program && !s.sessions.some((x) => x.source === 'import') ? (
          <Card>
            <T v="title">No program yet</T>
            <Button title="Choose a program" onPress={() => router.push('/templates')} />
          </Card>
        ) : !cardioToday ? (
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <Icon name="bed.double.fill" size={22} color={colors.dim} />
            <View style={{ flex: 1 }}>
              <T v="headline">Rest day</T>
              <T v="footnote" color={colors.dim}>Nothing planned today. Tap a day above to see what is next.</T>
            </View>
          </Card>
        ) : null}

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
    </Screen>
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


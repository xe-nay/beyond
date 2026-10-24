import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { byId, exercise } from '../../../src/catalog';
import { BodyMap } from '../../../src/components/BodyMap';
import { Icon } from '../../../src/components/Icon';
import { Button, Card, Ring, Row, Screen, Section, T } from '../../../src/components/ui';
import { fatigueReport, progression, weekStart } from '../../../src/domain/calc';
import { sum } from '../../../src/domain/nutrition';
import type { Region } from '../../../src/domain/types';
import { activeProgram, today, useStore } from '../../../src/store';
import { alpha, colors, space, type } from '../../../src/theme';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function Today() {
  const router = useRouter();
  const s = useStore();
  const program = activeProgram(s);
  const date = today();
  const weekday = (new Date().getDay() + 6) % 7;
  const done = s.sessions.filter((x) => x.finishedAt);
  const open = s.sessions.find((x) => x.id === s.activeSession && !x.finishedAt);

  // Next planned day: the first program day from today onwards that has not been done this week.
  const monday = weekStart();
  const doneThisWeek = new Set(done.filter((x) => Date.parse(x.date) >= monday.getTime()).map((x) => x.dayId));
  const next = program?.days.find((d) => d.weekday >= weekday && !doneThisWeek.has(d.id)) ?? program?.days.find((d) => !doneThisWeek.has(d.id)) ?? program?.days[0];
  const regions = useMemo(() => [...new Set(next?.exercises.flatMap((x) => byId[x.exerciseId]?.primary ?? []) ?? [])] as Region[], [next]);
  const imported = s.sessions.find((x) => !x.finishedAt && !x.startedAt && x.date === date);

  const eaten = sum(s.entries.filter((e) => e.date === date).map((e) => e.nutrients));
  const fatigue = fatigueReport(done, s.checks);
  const advice = next?.exercises[0] ? progression(done, next.exercises[0]) : null;
  const cardioWeek = s.cardio.filter((c) => c.completed && Date.parse(c.date) >= monday.getTime()).reduce((n, c) => n + c.minutes, 0);
  const cardioToday = s.cardio.find((c) => !c.completed && c.date === date);
  const tone = fatigue.status === 'Ease off' ? colors.amber : fatigue.status === 'Watch' ? colors.amber : fatigue.status === 'Ready' ? colors.lime : colors.dim;

  return (
    <Screen>
        <T v="title" color={colors.dim} style={{ fontWeight: '500', marginTop: -space.sm }}>
          {greeting()}{s.profile.name ? `, ${s.profile.name}` : ''}
        </T>

        {/* Week strip */}
        <Row style={{ justifyContent: 'space-between' }}>
          {DAYS.map((d, i) => {
            const day = new Date(monday);
            day.setDate(monday.getDate() + i);
            const iso = today(day);
            const trained = done.some((x) => x.date === iso) || s.cardio.some((c) => c.completed && c.date === iso);
            const planned = program?.days.some((p) => p.weekday === i);
            const isToday = i === weekday;
            return (
              <View key={i} style={{ alignItems: 'center', gap: 6 }}>
                <T v="caption" color={isToday ? colors.cyan : colors.faint}>{d}</T>
                <View style={{
                  width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: trained ? colors.lime : isToday ? colors.cyanSoft : colors.surface,
                  borderWidth: planned && !trained ? 1.5 : 0, borderColor: isToday ? colors.cyan : colors.hairlineStrong,
                }}>
                  {trained ? <Icon name="checkmark" size={14} color={colors.black} /> : <T v="label" color={isToday ? colors.cyan : colors.dim} style={type.num}>{day.getDate()}</T>}
                </View>
              </View>
            );
          })}
        </Row>

        {/* Next session */}
        {open ? (
          <Card style={{ borderColor: alpha(colors.cyan, 0.4) }} onPress={() => router.push('/workout')}>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ gap: 4 }}>
                <T v="caption" color={colors.cyan}>In progress</T>
                <T v="title">{open.name}</T>
                <T v="label" color={colors.dim}>{open.sets.filter((x) => !x.warmup).length} sets logged</T>
              </View>
              <Button title="Resume" icon="play.fill" onPress={() => router.push('/workout')} />
            </Row>
          </Card>
        ) : imported || next ? (
          <Card>
            <Row style={{ alignItems: 'flex-start' }}>
              <View style={{ flex: 1, gap: 6 }}>
                <T v="caption" color={colors.faint}>{imported ? 'Planned today' : next!.weekday === weekday ? 'Today' : 'Next up'}</T>
                <T v="title">{imported?.name ?? next!.name}</T>
                <T v="label" color={colors.dim}>
                  {(imported?.plan ?? next!.exercises).length} exercises · {(imported?.plan ?? next!.exercises).reduce((n, x) => n + x.sets, 0)} sets
                </T>
                <View style={{ gap: 4, marginTop: 6 }}>
                  {(imported?.plan ?? next!.exercises).slice(0, 4).map((x, i) => (
                    <T key={i} v="label" color={colors.dim} numberOfLines={1}>{exercise(x.exerciseId)?.name}</T>
                  ))}
                </View>
              </View>
              <View style={{ marginRight: -space.md, marginTop: -space.sm }}>
                <BodyMap primary={regions} scale={0.42} toggle={false} />
              </View>
            </Row>
            <Button title="Start workout" icon="play.fill" onPress={() => {
              s.startSession(imported ? { sessionId: imported.id } : { dayId: next!.id });
              router.push('/workout');
            }} />
          </Card>
        ) : (
          <Card>
            <T v="title">No program yet</T>
            <Button title="Choose a program" onPress={() => router.push('/templates')} />
          </Card>
        )}

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

        {advice && next && (
          <Section title="Coach">
            <Card>
              <Row style={{ alignItems: 'flex-start' }}>
                <Icon name={advice.kind === 'increase' ? 'arrow.up.right' : advice.kind === 'reduce' ? 'arrow.down.right' : 'wand.and.stars'} color={advice.kind === 'increase' ? colors.lime : colors.cyan} size={20} />
                <View style={{ flex: 1, gap: 4 }}>
                  <T v="headline">{exercise(next.exercises[0].exerciseId)?.name}: {advice.title}</T>
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


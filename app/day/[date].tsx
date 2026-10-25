import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActionSheetIOS, Platform, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { exercise } from '../../src/catalog';
import { DailyIntake } from '../../src/components/DailyIntake';
import { ExerciseImage } from '../../src/components/ExerciseImage';
import { PHASE } from '../../src/components/CardioVisuals';
import { Icon, type IconName } from '../../src/components/Icon';
import { MacroDonut, MacroLegend } from '../../src/components/Nutrition';
import { SummaryCard } from '../../src/components/SummaryCard';
import { Button, Card, Press, Row, Screen, Section, Stat, T } from '../../src/components/ui';
import { personalRecords } from '../../src/domain/calc';
import { cardioKcal, formatClock, pace, totalSeconds } from '../../src/domain/intervals';
import { formatWeight } from '../../src/domain/plates';
import type { CardioSession, Prescription } from '../../src/domain/types';
import { MEALS } from '../../src/meals';
import { plannedFor } from '../../src/schedule';
import { eatenOn, latestWeight, today, useStore } from '../../src/store';
import { alpha, colors, plural, space, type } from '../../src/theme';

const ACTIVITY_ICON: Record<string, IconName> = {
  Running: 'figure.run', Walking: 'figure.walk', Cycling: 'bicycle', Rowing: 'figure.rower', Swimming: 'figure.pool.swim',
  Elliptical: 'figure.elliptical', Stairs: 'figure.stair.stepper', HIIT: 'figure.highintensity.intervaltraining',
};

function relative(date: string, now: string) {
  const days = Math.round((Date.parse(date) - Date.parse(now)) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  return days > 0 ? `In ${days} days` : `${-days} days ago`;
}

/** One day from the calendar: what was done (workouts, cardio, food, intake) or what is planned. */
export default function Day() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const router = useRouter();
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
  const s = useStore();
  const now = today();
  const past = date < now;
  const isToday = date === now;
  const { sessions: imported, programDay, program, cardio: cardioPlanned, done, cardioDone } = plannedFor(s, date, now);
  const open = isToday ? s.sessions.find((x) => x.id === s.activeSession && !x.finishedAt) : undefined;
  const prs = useMemo(() => Object.fromEntries(done.map((x) => [x.id, personalRecords(s.sessions, x)])), [s.sessions, date]);
  const entries = s.entries.filter((e) => e.date === date);
  const eaten = eatenOn(s, date);
  const body = s.body.find((b) => b.date === date);
  const check = s.checks.find((c) => c.date === date);
  const cardWidth = Math.min(width - space.lg * 2, 380);
  const nothing = !done.length && !open && !imported.length && !programDay && !cardioDone.length && !cardioPlanned.length;

  const start = (input: { dayId?: string; sessionId?: string }) => {
    s.startSession(input);
    router.push('/workout');
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: '' }} />
      <View style={{ gap: 2, marginTop: -space.sm }}>
        <T v="caption" color={isToday ? colors.cyan : colors.faint}>{relative(date, now)} · {new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long' })}</T>
        <T v="largeTitle">{new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: date.slice(0, 4) === now.slice(0, 4) ? undefined : 'numeric' })}</T>
      </View>

      {/* Training */}
      {open && (
        <Card style={{ borderColor: alpha(colors.cyan, 0.4) }} onPress={() => router.push('/workout')}>
          <T v="caption" color={colors.cyan}>In progress</T>
          <T v="title">{open.name}</T>
          <Button title="Resume" icon="play.fill" onPress={() => router.push('/workout')} />
        </Card>
      )}
      {done.map((x, i) => (
        <Animated.View key={x.id} entering={reduced ? undefined : FadeInDown.delay(i * 80).duration(320)} style={{ alignItems: 'center', gap: space.sm }}>
          <SummaryCard session={x} prs={prs[x.id] ?? []} unit={s.profile.unit} width={cardWidth} />
          <Press onPress={() => router.push(`/session/${x.id}`)}>
            <Row gap={6}><T v="footnote" color={colors.dim}>Swipe to turn · every set</T><Icon name="chevron.right" size={11} color={colors.dim} /></Row>
          </Press>
        </Animated.View>
      ))}
      {imported.map((x) => (
        <PlanCard key={x.id} title={x.name} label={isToday ? 'Planned today' : 'Planned'} plan={x.plan} notes={x.notes} unit={s.profile.unit} onStart={isToday && !open ? () => start({ sessionId: x.id }) : undefined} />
      ))}
      {programDay && (
        <PlanCard title={programDay.name} label={`${program!.name}${isToday ? ' · today' : ''}`} plan={programDay.exercises} unit={s.profile.unit} onStart={isToday && !open ? () => start({ dayId: programDay.id }) : undefined} />
      )}

      {/* Cardio */}
      {cardioDone.map((c) => <CardioDone key={c.id} c={c} weightKg={latestWeight(s)} />)}
      {cardioPlanned.map((c) => <CardioPlan key={c.id} c={c} canStart={isToday} />)}

      {nothing && (
        <Card style={{ alignItems: 'center', paddingVertical: space.xl }}>
          <Icon name="bed.double.fill" size={24} color={colors.faint} />
          <T v="headline" color={colors.dim}>{past ? 'Rest day' : 'Nothing planned'}</T>
        </Card>
      )}

      {/* Food and intake, for days that have happened */}
      {!past && !isToday ? null : (
        <>
          <Section title="Nutrition">
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.xl }}>
              <MacroDonut n={eaten} size={120} label={`of ${s.targets.kcal}`} />
              <View style={{ flex: 1 }}><MacroLegend n={eaten} targets={s.targets} /></View>
            </Card>
            {entries.length > 0 ? (
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
              </Card>
            ) : (
              <T v="footnote" color={colors.faint}>No food logged.</T>
            )}
          </Section>
          <DailyIntake date={date} />
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
      {/* Change what was logged: a workout's sets, or the day's food */}
      {(past || isToday) && (
        <Button kind="secondary" icon="pencil" title="Edit" onPress={() => {
          const options = [...done.map((x) => ({ label: `Edit ${x.name}`, go: () => router.push({ pathname: '/session/[id]', params: { id: x.id, edit: '1' } }) })), { label: 'Edit food', go: () => router.navigate({ pathname: '/(tabs)/food', params: { date } }) }];
          if (options.length === 1) return options[0].go();
          if (Platform.OS !== 'ios') return options[0].go();
          ActionSheetIOS.showActionSheetWithOptions({ options: [...options.map((o) => o.label), 'Cancel'], cancelButtonIndex: options.length }, (k) => k < options.length && options[k].go());
        }} />
      )}
    </Screen>
  );
}

function PlanCard({ title, label, plan, unit, onStart, notes }: { title: string; label: string; plan: Prescription[]; unit: 'kg' | 'lb'; onStart?: () => void; notes?: string }) {
  const router = useRouter();
  const sets = plan.reduce((n, x) => n + x.sets, 0);
  return (
    <Card>
      <View style={{ gap: 2 }}>
        <T v="caption" color={colors.cyan}>{label}</T>
        <T v="title">{title}</T>
        <T v="footnote" color={colors.dim}>{plural(plan.length, 'exercise')} · {plural(sets, 'set')}</T>
      </View>
      {plan.map((x, i) => {
        const e = exercise(x.exerciseId);
        return (
          <Press key={`${x.exerciseId}-${i}`} onPress={() => router.push(`/exercise/${x.exerciseId}`)} haptic={false}>
            <Row>
              {e && <ExerciseImage exercise={e} thumb style={{ width: 44, height: 44 }} />}
              <View style={{ flex: 1 }}>
                <T v="headline" numberOfLines={1}>{x.superset ? `${x.superset} · ` : ''}{e?.name ?? x.exerciseId}</T>
                <T v="footnote" color={colors.dim} style={type.num}>
                  {x.warmupSets ? `${x.warmupSets} warm-up + ` : ''}{x.sets} × {x.minReps === x.maxReps ? x.minReps : `${x.minReps}–${x.maxReps}`} · RIR {x.rir} · {formatClock(x.restSeconds)}
                  {x.loadKg ? ` · ${formatWeight(x.loadKg, unit)} ${unit}` : ''}
                </T>
              </View>
            </Row>
          </Press>
        );
      })}
      {!!notes && <T v="callout" color={colors.dim}>{notes}</T>}
      {onStart && <Button title="Start workout" icon="play.fill" onPress={onStart} />}
    </Card>
  );
}

/** A planned cardio session in full: its phases drawn to scale, each with its time and cue, and the notes. */
function CardioPlan({ c, canStart }: { c: CardioSession; canStart: boolean }) {
  const router = useRouter();
  const p = c.plan!;
  const total = totalSeconds(p);
  const steps = [
    p.warmupSeconds ? { kind: 'warmup' as const, label: 'Warm-up', time: formatClock(p.warmupSeconds), cue: '', seconds: p.warmupSeconds } : null,
    { kind: 'work' as const, label: p.rounds > 1 ? `Work × ${p.rounds}` : 'Work', time: formatClock(p.workSeconds), cue: p.workCue, seconds: p.workSeconds * p.rounds },
    p.recoverySeconds && p.rounds > 1 ? { kind: 'recovery' as const, label: `Recover × ${p.rounds - 1}`, time: formatClock(p.recoverySeconds), cue: p.recoveryCue, seconds: p.recoverySeconds * (p.rounds - 1) } : null,
    p.cooldownSeconds ? { kind: 'cooldown' as const, label: 'Cool-down', time: formatClock(p.cooldownSeconds), cue: '', seconds: p.cooldownSeconds } : null,
  ].filter(Boolean) as { kind: keyof typeof PHASE; label: string; time: string; cue: string; seconds: number }[];
  const start = () => {
    useStore.getState().set({ cardioRun: { id: c.id, date: today(), plan: p, banked: 0, resumedAt: Date.now() } });
    router.push('/cardio-run');
  };
  return (
    <Card>
      <Row>
        <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(colors.cyan, 0.14) }}>
          <Icon name={ACTIVITY_ICON[c.activity] ?? 'figure.run'} size={18} color={colors.cyan} />
        </View>
        <View style={{ flex: 1 }}>
          <T v="caption" color={colors.faint}>Planned cardio · {c.activity}</T>
          <T v="title3" numberOfLines={2}>{c.name ?? c.activity}</T>
        </View>
        <T v="title3" style={type.num}>{formatClock(total)}</T>
      </Row>
      {/* The session to scale: each phase's share of the total time, in its colour */}
      <View style={{ flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', gap: 2 }}>
        {p.warmupSeconds > 0 && <View style={{ flex: p.warmupSeconds, backgroundColor: PHASE.warmup.a }} />}
        {Array.from({ length: p.rounds }, (_, i) => (
          <View key={i} style={{ flex: p.workSeconds + (i < p.rounds - 1 ? p.recoverySeconds : 0), flexDirection: 'row', gap: 1 }}>
            <View style={{ flex: p.workSeconds, backgroundColor: PHASE.work.a }} />
            {i < p.rounds - 1 && p.recoverySeconds > 0 && <View style={{ flex: p.recoverySeconds, backgroundColor: PHASE.recovery.a }} />}
          </View>
        ))}
        {p.cooldownSeconds > 0 && <View style={{ flex: p.cooldownSeconds, backgroundColor: PHASE.cooldown.a }} />}
      </View>
      <View style={{ gap: space.sm }}>
        {steps.map((x) => (
          <Row key={x.kind} style={{ alignItems: 'flex-start' }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 6, backgroundColor: PHASE[x.kind].a }} />
            <View style={{ flex: 1 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T v="headline">{x.label}</T>
                <T v="headline" color={colors.dim} style={type.num}>{x.time}</T>
              </Row>
              {!!x.cue && <T v="footnote" color={colors.dim}>{x.cue}</T>}
            </View>
          </Row>
        ))}
      </View>
      <T v="footnote" color={colors.faint}>{p.countdown ? `${p.countdown} s countdown before each change` : 'No countdown beeps'}{['Running', 'Walking', 'Cycling'].includes(c.activity) ? ' · distance by GPS' : ''}</T>
      {!!c.notes && <T v="callout" color={colors.dim}>{c.notes}</T>}
      {canStart && <Button title="Start" icon="play.fill" onPress={start} />}
    </Card>
  );
}

function CardioDone({ c, weightKg }: { c: CardioSession; weightKg: number | null }) {
  const kcal = cardioKcal(c.activity, c.minutes, weightKg);
  const p = pace(c.minutes, c.distanceKm);
  return (
    <Card>
      <Row>
        <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(colors.lime, 0.16) }}>
          <Icon name={ACTIVITY_ICON[c.activity] ?? 'figure.run'} size={18} color={colors.lime} />
        </View>
        <View style={{ flex: 1 }}>
          <T v="caption" color={colors.faint}>Cardio</T>
          <T v="title">{c.activity}</T>
        </View>
      </Row>
      <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap', rowGap: space.md }}>
        <Stat small label="Time" value={c.minutes} unit="min" />
        {c.distanceKm ? <Stat small label="Distance" value={c.distanceKm.toFixed(2)} unit="km" /> : null}
        {p ? <Stat small label="Pace" value={p.replace(' /km', '')} unit="/km" /> : null}
      </Row>
      <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap', rowGap: space.md }}>
        {c.rpe ? <Stat small label="Effort" value={`${c.rpe}/10`} /> : null}
        {c.avgHr ? <Stat small label="Avg HR" value={c.avgHr} unit="bpm" /> : null}
        {kcal ? <Stat small label="Energy" value={kcal} unit="kcal" /> : null}
      </Row>
      {c.plan && c.plan.rounds > 1 && (
        <T v="footnote" color={colors.dim}>{c.plan.rounds} × {formatClock(c.plan.workSeconds)} work{c.plan.recoverySeconds ? ` / ${formatClock(c.plan.recoverySeconds)} recovery` : ''}{c.plan.workCue ? ` · ${c.plan.workCue}` : ''}</T>
      )}
      {!!c.notes && <T v="footnote" color={colors.dim}>{c.notes}</T>}
    </Card>
  );
}

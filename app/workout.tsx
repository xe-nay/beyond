import { useRouter } from 'expo-router';
import { useScreenOn } from '../src/keepAwake';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, LinearTransition, ZoomIn, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { defaultImplements, exercise, loadKind } from '../src/catalog';
import { ExerciseImage } from '../src/components/ExerciseImage';
import { Icon } from '../src/components/Icon';
import { motionFor, WeightControl } from '../src/components/LoadVisual';
import { RestBar } from '../src/components/RestBar';
import { Button, Card, Divider, Press, Row, Stepper, T, thud } from '../src/components/ui';
import { bodyShare } from '../src/domain/bodyweight';
import { e1rm, e1rmWithRir, fatigueIndex, loadForRir, planSets, previousSets, progression, repDrop, rirToRpe, setKg, volumeLoad, working } from '../src/domain/calc';
import { formatClock } from '../src/domain/intervals';
import { dumbbellStep, formatWeight, roundTo, toDisplay, toKg } from '../src/domain/plates';
import type { WorkoutSet } from '../src/domain/types';
import { prepareAudio } from '../src/sound';
import { latestWeight, useStore } from '../src/store';
import { alpha, colors, radius, space, type } from '../src/theme';

interface Draft { kg: number; reps: number; rir: number | null; warmup: boolean; implements: 1 | 2; workKg?: number }

// Rest after a warm-up set: shorter between warm-ups, a little longer before the first working set.
// App defaults; studies on warm-ups set the loads, not these rests.
const WARM_REST = 60;
const LAST_WARM_REST = 90;

export default function Workout() {
  useScreenOn('workout');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const s = useStore();
  const session = s.sessions.find((x) => x.id === s.activeSession);
  const history = useMemo(() => s.sessions.filter((x) => x.finishedAt), [s.sessions]);
  const [index, setIndex] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const [pulse, setPulse] = useState(0);
  const [, tick] = useState(0);
  const scroll = useRef<ScrollView>(null);
  const strip = useRef<ScrollView>(null);
  const chips = useRef<Record<number, { x: number; w: number }>>({});
  const { width: screenW } = useWindowDimensions();
  useEffect(() => {
    const c = chips.current[index];
    if (c) strip.current?.scrollTo({ x: Math.max(0, c.x + c.w / 2 - screenW / 2), animated: true });
  }, [index, screenW]);

  useEffect(() => {
    prepareAudio();
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!session) router.back();
  }, [session]);
  if (!session) return <View style={{ flex: 1, backgroundColor: colors.black }} />;

  const plan = session.plan;
  const p = plan[Math.min(index, plan.length - 1)];
  const ex = p ? exercise(p.exerciseId) : undefined;
  const kind = loadKind(ex);
  const unit = s.profile.unit;
  // Bodyweight exercises count the share of body weight they move (see domain/bodyweight.ts).
  const share = bodyShare(ex);
  const weighed = latestWeight(s);
  const bodyNow = share && weighed ? Math.round(share.share * weighed * 10) / 10 : 0;
  // A set's weight as shown; a bodyweight set with nothing to count says what it is instead of 0.
  const kgText = (kg: number) => (kind === 'bodyweight' && kg <= 0 ? (ex?.equipment === 'band' ? 'Band' : 'BW') : formatWeight(kg, unit));
  const done = p ? session.sets.filter((x) => x.exerciseId === p.exerciseId) : [];
  const doneWork = working(done);
  const prev = p ? previousSets(history, p.exerciseId, session.id) : [];
  const advice = p ? progression(history, p, 2.5, kind === 'bodyweight') : null;
  // Snaps a weight to what the equipment allows (plates, dumbbell steps).
  const snap = (kg: number) => {
    const v = toDisplay(kg, unit);
    const step = kind === 'dumbbell' || kind === 'kettlebell' ? dumbbellStep(unit, v) : unit === 'kg' ? 2.5 : 5;
    return toKg(roundTo(v, step), unit);
  };
  // This exercise's plan with weights: the warm-up ramp and the working weight (see planSets).
  const planned = p ? planSets(p, history, snap) : null;
  const warmLogged = done.filter((x) => x.warmup).length;

  // Where the numbers start: this session's last set (the weight carries forward), else the same
  // set from last time, else the coach's suggestion, else the program, else a sensible default.
  const prevAt = (i: number) => prev[i] ?? prev[prev.length - 1];
  const fallbackKg = () => {
    if (!p) return 0;
    const last = doneWork[doneWork.length - 1];
    if (last) return last.loadKg;
    if (planned?.workKg) return planned.workKg;
    if (advice?.kind === 'increase' && advice.nextKg) return advice.nextKg;
    if (prevAt(0)) return prevAt(0).loadKg;
    if (p.loadKg !== null) return p.loadKg;
    return kind === 'barbell' ? 20 : kind === 'bodyweight' ? 0 : kind === 'kettlebell' ? 12 : 10;
  };
  const drafts = session.drafts ?? {};
  const baseKg = fallbackKg();
  const firstWarm = planned && !doneWork.length && !warmLogged ? planned.warmups[0] : undefined;
  const draft: Draft = (p && drafts[p.exerciseId]) ?? {
    kg: firstWarm ? snap(baseKg * firstWarm.share) : baseKg,
    reps: firstWarm ? firstWarm.reps : prevAt(doneWork.length)?.reps ?? doneWork[doneWork.length - 1]?.reps ?? p?.maxReps ?? 10,
    rir: p?.rir ?? 2,
    warmup: !!firstWarm,
    implements: doneWork[doneWork.length - 1]?.implements ?? prevAt(0)?.implements ?? defaultImplements(ex),
    ...(firstWarm ? { workKg: baseKg } : {}),
  };
  // The working weight, also while a warm-up is being entered; the warm-ups ramp up to it.
  const workingKg = draft.warmup ? draft.workKg ?? baseKg : draft.kg;
  const ramp = (planned?.warmups ?? []).map((w) => ({ ...w, kg: snap(workingKg * w.share) }));
  const workReps = prevAt(doneWork.length)?.reps ?? doneWork[doneWork.length - 1]?.reps ?? p?.maxReps ?? 10;
  // The weight for the next set's reps at the program's RIR, from the latest set that has an RIR.
  const aim = (() => {
    if (!p || draft.warmup || kind === 'bodyweight') return null;
    const today = [...doneWork].reverse().find((x) => x.rir !== null);
    const from = today ?? [...prev].reverse().find((x) => !x.warmup && x.rir !== null);
    const kg = from ? loadForRir(from, draft.reps, p.rir) : null;
    if (!from || kg === null) return null;
    const v = toDisplay(kg, unit);
    const step = kind === 'dumbbell' || kind === 'kettlebell' ? dumbbellStep(unit, v) : unit === 'kg' ? 2.5 : 5;
    return { kg: toKg(roundTo(v, step), unit), from: from as WorkoutSet & { rir: number }, thisSession: !!today };
  })();
  const setDraft = (patch: Partial<Draft>) => p && s.patchSession(session.id, { drafts: { ...drafts, [p.exerciseId]: { ...draft, ...patch } } });

  const elapsed = session.startedAt ? (Date.now() - Date.parse(session.startedAt)) / 1000 : 0;
  const totalPlanned = plan.reduce((n, x) => n + x.sets, 0);
  const totalDone = working(session.sets).length;

  const complete = () => {
    if (!p) return;
    if (editing) {
      s.updateSet(session.id, editing, { loadKg: draft.kg, reps: draft.reps, rir: draft.rir, warmup: draft.warmup, implements: draft.implements });
      setEditing(null);
      return;
    }
    s.logSet(session.id, { exerciseId: p.exerciseId, loadKg: draft.kg, reps: draft.reps, rir: draft.warmup ? null : draft.rir, warmup: draft.warmup, implements: kind === 'dumbbell' || kind === 'kettlebell' ? draft.implements : undefined });
    thud();
    setPulse((n) => n + 1);
    if (draft.warmup) {
      const nextWarm = ramp[warmLogged + 1];
      if (s.timer.autoStart) s.startRest(nextWarm ? WARM_REST : LAST_WARM_REST, p.exerciseId, session.id);
      return setDraft(nextWarm
        ? { kg: nextWarm.kg, reps: nextWarm.reps }
        : { warmup: false, kg: draft.workKg ?? baseKg, reps: workReps, workKg: undefined });
    }
    // Same weight for the next set; reps start from what that set did last time.
    setDraft({ reps: prev[doneWork.length + 1]?.reps ?? draft.reps });

    // Supersets: go to the next exercise in the group that still has sets; rest after a full round.
    const after = useStore.getState().sessions.find((x) => x.id === session.id)!;
    const left = (i: number) => plan[i].sets - working(after.sets.filter((x) => x.exerciseId === plan[i].exerciseId)).length;
    if (p.superset) {
      const group = plan.map((x, i) => ({ x, i })).filter(({ x, i }) => x.superset === p.superset && left(i) > 0);
      const nextIn = group.find(({ i }) => i > index) ?? group[0];
      if (nextIn && nextIn.i !== index) {
        setIndex(nextIn.i);
        if (nextIn.i > index) return;
      }
    }
    if (s.timer.autoStart && left(index) >= 0) s.startRest(p.restSeconds, p.exerciseId, session.id);
    if (left(index) <= 0) {
      const nextIdx = plan.findIndex((_, i) => i > index && left(i) > 0);
      if (nextIdx >= 0) setTimeout(() => setIndex(nextIdx), 350);
    }
  };

  const editSet = (set: WorkoutSet) => {
    setEditing(set.id);
    s.patchSession(session.id, { drafts: { ...drafts, [set.exerciseId]: { kg: set.loadKg, reps: set.reps, rir: set.rir, warmup: set.warmup, implements: set.implements ?? 1 } } });
  };

  const rows = Array.from({ length: Math.max(p?.sets ?? 0, doneWork.length) }, (_, i) => doneWork[i] ?? null);
  const warmups = done.filter((x) => x.warmup);

  return (
    <View style={{ flex: 1, backgroundColor: colors.black, paddingTop: insets.top }}>
      {/* Header */}
      <Row style={{ paddingHorizontal: space.lg, paddingVertical: space.sm, justifyContent: 'space-between' }}>
        <Press onPress={() => router.back()} style={styles.round} hitSlop={8}><Icon name="chevron.down" size={18} /></Press>
        <View style={{ alignItems: 'center' }}>
          <T v="headline" numberOfLines={1}>{session.name}</T>
          <T v="footnote" color={colors.cyan} style={[type.num, { fontWeight: "600" }]}>{formatClock(elapsed)}</T>
        </View>
        <Button small kind="lime" title="Finish" onPress={() => router.push('/finish')} />
      </Row>

      {/* Progress across the whole session */}
      <View style={{ paddingHorizontal: space.lg, paddingBottom: space.sm }}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${totalPlanned ? Math.min(100, (totalDone / totalPlanned) * 100) : 0}%`, transitionProperty: 'width', transitionDuration: 400 } as any]} />
        </View>
      </View>

      {/* Exercise strip */}
      <ScrollView ref={strip} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.sm, paddingBottom: space.md }} style={{ flexGrow: 0 }}>
        {plan.map((x, i) => {
          const e = exercise(x.exerciseId);
          const n = working(session.sets.filter((y) => y.exerciseId === x.exerciseId)).length;
          const full = n >= x.sets;
          return (
            <View key={`${x.exerciseId}-${i}`} onLayout={(e) => { chips.current[i] = { x: e.nativeEvent.layout.x, w: e.nativeEvent.layout.width }; if (i === index && strip.current) strip.current.scrollTo({ x: Math.max(0, e.nativeEvent.layout.x + e.nativeEvent.layout.width / 2 - screenW / 2), animated: false }); }}>
            <Press onPress={() => { setIndex(i); setEditing(null); }} style={[styles.chip, i === index && styles.chipOn]}>
              {e && <ExerciseImage exercise={e} thumb style={{ width: 28, height: 28, borderRadius: 8 }} />}
              <View>
                <T v="label" numberOfLines={1} style={{ maxWidth: 110, fontWeight: '600' }} color={i === index ? colors.text : colors.dim}>{e?.name ?? x.exerciseId}</T>
                <T v="caption" color={full ? colors.lime : colors.faint}>{n}/{x.sets}{x.superset ? ` · ${x.superset}` : ''}</T>
              </View>
            </Press>
            </View>
          );
        })}
        <Press onPress={() => router.push({ pathname: '/library', params: { pick: 'session' } })} style={[styles.chip, styles.addChip]}>
          <View style={styles.addIcon}><Icon name="plus" size={14} color={colors.black} /></View>
          <T v="footnote" color={colors.cyan} style={{ fontWeight: '600' }}>Add</T>
        </Press>
      </ScrollView>

      {!p || !ex ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
          <T v="title">Add an exercise</T>
          <Button title="Browse exercises" icon="plus" onPress={() => router.push({ pathname: '/library', params: { pick: 'session' } })} />
        </View>
      ) : (
        <ScrollView ref={scroll} contentContainerStyle={{ padding: space.lg, paddingTop: 0, gap: space.lg, paddingBottom: 160 }} keyboardShouldPersistTaps="handled">
          <Animated.View key={p.exerciseId + index} entering={reduced ? undefined : FadeIn.duration(180)} style={{ gap: space.lg }}>
            {/* Exercise hero */}
            <View>
              <ExerciseImage exercise={ex} style={{ height: 200 }} />
              <Row style={styles.heroBar}>
                <View style={{ flex: 1 }}>
                  <T v="title" numberOfLines={2}>{ex.name}</T>
                  <T v="label" color={colors.dim}>
                    {p.sets} × {p.minReps === p.maxReps ? p.minReps : `${p.minReps}–${p.maxReps}`} · RIR {p.rir} · rest {formatClock(p.restSeconds)}
                  </T>
                </View>
                <Press onPress={() => router.push({ pathname: '/prescription', params: { session: session.id, index } })} style={styles.round}><Icon name="pencil" size={15} /></Press>
                <Press onPress={() => router.push({ pathname: '/swap', params: { session: session.id, index } })} style={styles.round}><Icon name="arrow.left.arrow.right" size={15} /></Press>
                <Press onPress={() => router.push(`/exercise/${ex.id}`)} style={styles.round}><Icon name="info.circle" size={16} /></Press>
              </Row>
            </View>

            {advice && (
              <Row gap={space.sm}>
                <Icon name={advice.kind === 'increase' ? 'arrow.up.right' : 'wand.and.stars'} size={15} color={advice.kind === 'increase' ? colors.lime : colors.cyan} />
                <T v="label" color={colors.dim} style={{ flex: 1 }}>{advice.title}{prev.length ? ` · last ${prev.map((x) => `${kgText(setKg(x))}×${x.reps}`).join(', ')}` : ''}</T>
              </Row>
            )}

            {aim && (
              <Press onPress={() => setDraft({ kg: aim.kg })} haptic={aim.kg !== draft.kg} label="Use the suggested weight">
                <Row gap={space.sm} style={{ padding: space.md, borderRadius: radius.md, backgroundColor: alpha(colors.cyan, 0.08), borderWidth: 0.5, borderColor: alpha(colors.cyan, 0.3) }}>
                  <Icon name="scope" size={16} color={colors.cyan} />
                  <View style={{ flex: 1 }}>
                    <T v="headline">{formatWeight(aim.kg, unit)} {unit}{draft.implements === 2 ? ' each' : ''} <T v="footnote" color={colors.dim}>for {draft.reps} reps at RIR {p.rir}</T></T>
                    <T v="footnote" color={colors.faint}>From your {formatWeight(aim.from.loadKg, unit)} × {aim.from.reps} at RIR {aim.from.rir}{aim.thisSession ? ' today' : ' last time'}</T>
                  </View>
                  {aim.kg !== draft.kg ? <T v="footnote" color={colors.cyan}>Use</T> : <Icon name="checkmark" size={14} color={colors.lime} />}
                </Row>
              </Press>
            )}

            {/* Sets */}
            <Card style={{ padding: 0, gap: 0 }}>
              <Row style={styles.setHead}>
                <T v="caption" color={colors.faint} style={{ width: 28 }}>Set</T>
                <T v="caption" color={colors.faint} style={{ flex: 1 }}>Previous</T>
                <T v="caption" color={colors.faint} style={{ width: 92, textAlign: 'right' }}>{unit} × reps</T>
                <T v="caption" color={colors.faint} style={{ width: 40, textAlign: 'right' }}>RIR</T>
                <View style={{ width: 34 }} />
              </Row>
              {warmups.map((w, wi) => (
                <Press key={w.id} onPress={() => editSet(w)} haptic={false}>
                  <Row style={[styles.setRow, editing === w.id && styles.setEditing]}>
                    <T v="label" color={colors.amber} style={{ width: 28, fontWeight: '700' }}>W{wi + 1}</T>
                    <T v="label" color={colors.faint} style={{ flex: 1 }}>Warm-up</T>
                    <T v="headline" style={[type.num, { width: 92, textAlign: 'right' }]}>{w.implements === 2 ? '2×' : ''}{kgText(setKg(w))} × {w.reps}</T>
                    <View style={{ width: 40 }} />
                    <Press onPress={() => s.deleteSet(session.id, w.id)} style={{ width: 34, alignItems: 'flex-end' }}><Icon name="xmark" size={12} color={colors.faint} /></Press>
                  </Row>
                </Press>
              ))}
              {ramp.slice(warmLogged).map((w, k) => {
                const on = k === 0 && draft.warmup;
                return (
                  <Press key={`pw${warmLogged + k}`} haptic={false} onPress={() => setDraft({ warmup: true, workKg: draft.warmup ? draft.workKg : draft.kg, kg: w.kg, reps: w.reps })}>
                    <Row style={[styles.setRow, on && { backgroundColor: alpha(colors.amber, 0.08) }]}>
                      <T v="label" color={colors.amber} style={{ width: 28, fontWeight: '700' }}>W{warmLogged + k + 1}</T>
                      <T v="label" color={colors.faint} style={{ flex: 1 }}>Warm-up · {Math.round(w.share * 100)}%</T>
                      <T v="headline" color={on ? colors.text : colors.faint} style={[type.num, { width: 92, textAlign: 'right' }]}>{formatWeight(w.kg, unit)} × {w.reps}</T>
                      <View style={{ width: 40 }} />
                      <View style={{ width: 34, alignItems: 'flex-end' }}>
                        <View style={[styles.check, { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: on ? colors.amber : colors.hairlineStrong }]} />
                      </View>
                    </Row>
                  </Press>
                );
              })}
              {rows.map((set, i) => {
                const pv = prev[i];
                const next = !set && i === doneWork.length && !draft.warmup;
                return (
                  <Animated.View key={set?.id ?? `p${i}`} layout={reduced ? undefined : LinearTransition.duration(200)}>
                    <Press onPress={() => set && editSet(set)} haptic={false} disabled={!set}>
                      <Row style={[styles.setRow, next && styles.setNext, editing === set?.id && styles.setEditing]}>
                        <T v="label" color={next ? colors.cyan : colors.dim} style={{ width: 28, fontWeight: '700' }}>{i + 1}</T>
                        <T v="label" color={colors.faint} style={[type.num, { flex: 1 }]}>{pv ? `${kgText(setKg(pv))}×${pv.reps}` : '—'}</T>
                        <T v="headline" color={set ? colors.text : colors.faint} style={[type.num, { width: 92, textAlign: 'right' }]}>
                          {set ? `${set.implements === 2 ? '2×' : ''}${kgText(setKg(set))} × ${set.reps}` : `${draft.implements === 2 && (kind === 'dumbbell' || kind === 'kettlebell') ? '2×' : ''}${kgText(workingKg + bodyNow)} × ${next ? draft.reps : pv?.reps ?? p.maxReps}`}
                        </T>
                        <T v="label" color={colors.dim} style={[type.num, { width: 40, textAlign: 'right' }]}>{set ? set.rir ?? '—' : ''}</T>
                        <View style={{ width: 34, alignItems: 'flex-end' }}>
                          {set ? (
                            <Animated.View entering={reduced ? undefined : ZoomIn.duration(220)} style={styles.check}><Icon name="checkmark" size={12} color={colors.black} /></Animated.View>
                          ) : (
                            <View style={[styles.check, { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: next ? colors.cyan : colors.hairlineStrong }]} />
                          )}
                        </View>
                      </Row>
                    </Press>
                  </Animated.View>
                );
              })}
              <Row style={{ justifyContent: 'center', padding: space.sm }} gap={space.xl}>
                <Press onPress={() => s.patchPlan(session.id, index, { sets: p.sets + 1 })} haptic><Row gap={4}><Icon name="plus" size={13} color={colors.cyan} /><T v="label" color={colors.cyan}>Set</T></Row></Press>
                {p.sets > 1 && p.sets > doneWork.length && (
                  <Press onPress={() => s.patchPlan(session.id, index, { sets: p.sets - 1 })}><Row gap={4}><Icon name="minus" size={13} color={colors.dim} /><T v="label" color={colors.dim}>Set</T></Row></Press>
                )}
                {editing && (
                  <Press onPress={() => { s.deleteSet(session.id, editing); setEditing(null); }}><Row gap={4}><Icon name="trash" size={13} color={colors.red} /><T v="label" color={colors.red}>Delete</T></Row></Press>
                )}
              </Row>
            </Card>

            {/* Load + reps + effort */}
            <Card style={{ gap: space.xl }}>
              <WeightControl kg={draft.kg} onChange={(kg) => setDraft({ kg })} unit={unit} onUnit={(u) => s.setProfile({ unit: u })} kind={kind} pulse={pulse}
                body={kind === 'bodyweight' ? { share: share?.share ?? null, weightKg: weighed, band: ex.equipment === 'band' } : undefined}
                count={draft.implements} onCount={(n) => setDraft({ implements: n })} motion={motionFor(ex.name, ex.group)} />
              <Divider />
              <Row>
                <Stepper label="Reps" value={draft.reps} onChange={(reps) => setDraft({ reps })} min={0} max={100} big />
              </Row>
              <View style={{ gap: space.sm }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <T v="caption" color={colors.faint}>Reps in reserve</T>
                  <T v="caption" color={colors.cyan}>{draft.rir === null ? 'Not rated' : `RPE ${rirToRpe(draft.rir) ?? '≤5'}`}</T>
                </Row>
                <Row gap={6}>
                  {[0, 1, 2, 3, 4, 5].map((r) => (
                    <Press key={r} onPress={() => setDraft({ rir: draft.rir === r ? null : r })} style={[styles.rir, draft.rir === r && styles.rirOn]}>
                      <T v="headline" color={draft.rir === r ? colors.black : colors.text}>{r === 5 ? '5+' : r}</T>
                    </Press>
                  ))}
                </Row>
              </View>
              <Row>
                <Press onPress={() => (draft.warmup
                  ? setDraft({ warmup: false, kg: draft.workKg ?? draft.kg, reps: workReps, workKg: undefined })
                  : setDraft({ warmup: true, workKg: draft.kg, kg: ramp[warmLogged]?.kg ?? snap(draft.kg * 0.5), reps: ramp[warmLogged]?.reps ?? 8 }))} style={[styles.toggle, draft.warmup && { borderColor: colors.amber, backgroundColor: alpha(colors.amber, 0.12) }]}>
                  <T v="label" color={draft.warmup ? colors.amber : colors.dim}>Warm-up set</T>
                </Press>
              </Row>
            </Card>

            <EffortNumbers sets={doneWork} draft={draft} unit={unit} />

            <TextInput
              placeholder="Notes"
              placeholderTextColor={colors.faint}
              defaultValue={session.notes}
              onEndEditing={(e) => s.patchSession(session.id, { notes: e.nativeEvent.text })}
              multiline
              style={styles.notes}
            />
          </Animated.View>
        </ScrollView>
      )}

      {/* Dock: rest timer + main action */}
      {p && (
        <View style={[styles.dock, { paddingBottom: insets.bottom + space.sm }]}>
          <RestBar />
          <Button
            title={editing ? 'Save changes' : draft.warmup ? 'Log warm-up' : `Complete set ${Math.min(doneWork.length + 1, Math.max(p.sets, doneWork.length + 1))}`}
            icon="checkmark"
            kind={doneWork.length >= p.sets && !editing ? 'secondary' : 'primary'}
            onPress={complete}
          />
        </View>
      )}
    </View>
  );
}

/** The calculations behind the set, shown plainly. */
function EffortNumbers({ sets, draft, unit }: { sets: WorkoutSet[]; draft: Draft; unit: 'kg' | 'lb' }) {
  const [open, setOpen] = useState(false);
  const load = draft.kg * draft.implements;
  const est = e1rm(load, draft.reps);
  const estRir = e1rmWithRir(load, draft.reps, draft.rir);
  const drop = repDrop(sets);
  const fi = fatigueIndex(sets);
  const vol = volumeLoad(sets);
  const rests = sets.map((x) => x.restSeconds).filter((x): x is number => x !== null);
  const items: [string, string, string?][] = [
    ['e1RM', est ? `${formatWeight(est, unit)} ${unit}` : '—', draft.implements === 2 ? 'Epley on the total of both dumbbells' : 'Epley: load × (1 + reps/30), up to 10 reps'],
    ['e1RM with RIR', estRir ? `${formatWeight(estRir, unit)} ${unit}` : '—', 'Uses reps + reps in reserve'],
    ['RPE', draft.rir === null ? '—' : String(rirToRpe(draft.rir) ?? '≤5'), 'RPE = 10 − RIR'],
    ['Volume', `${Math.round(toDisplay(vol, unit)).toLocaleString()} ${unit}`, 'Working sets: total load × reps (both dumbbells counted)'],
    ['Rep drop', drop ? `${Math.round(drop.percent)}%` : '—', 'First to last set at the same load'],
    ['Fatigue index', fi === null ? '—' : `${Math.round(fi)}%`, 'Best set volume to last set volume'],
    ['Avg rest', rests.length ? formatClock(rests.reduce((a, b) => a + b, 0) / rests.length) : '—', 'Measured between logged sets'],
  ];
  return (
    <Card style={{ gap: space.sm }}>
      <Press onPress={() => setOpen(!open)} haptic={false}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row gap={space.sm}><Icon name="chart.bar.fill" size={15} color={colors.cyan} /><T v="headline">Numbers</T></Row>
          <Row gap={space.md}>
            <T v="label" color={colors.dim} style={type.num}>{est ? `e1RM ${formatWeight(est, unit)}` : ''}{drop ? ` · ${Math.round(drop.percent)}%` : ''}</T>
            <Icon name="chevron.down" size={13} color={colors.faint} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
          </Row>
        </Row>
      </Press>
      {open && (
        <Animated.View entering={FadeIn.duration(180)} style={{ gap: 2 }}>
          {items.map(([k, v, why]) => (
            <Row key={k} style={{ paddingVertical: 7, alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <T v="label">{k}</T>
                {why && <T v="caption" color={colors.faint} style={{ textTransform: 'none', letterSpacing: 0, fontWeight: '400' }}>{why}</T>}
              </View>
              <T v="headline" color={colors.cyan} style={type.num}>{v}</T>
            </Row>
          ))}
        </Animated.View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  round: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  progressTrack: { height: 3, borderRadius: 2, backgroundColor: colors.surface3, overflow: 'hidden' },
  progressFill: { height: 3, borderRadius: 2, backgroundColor: colors.lime },
  chip: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: 6, paddingRight: space.md, height: 46, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.hairline },
  addChip: { borderStyle: 'dashed', borderColor: alpha(colors.cyan, 0.45), backgroundColor: alpha(colors.cyan, 0.06) },
  addIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: colors.cyan, alignItems: 'center', justifyContent: 'center' },
  chipOn: { borderColor: alpha(colors.cyan, 0.6), backgroundColor: alpha(colors.cyan, 0.08) },
  heroBar: { marginTop: space.md, gap: space.sm, alignItems: 'center' },
  setHead: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.xs },
  setRow: { paddingHorizontal: space.lg, height: 48 },
  setNext: { backgroundColor: alpha(colors.cyan, 0.06) },
  setEditing: { backgroundColor: alpha(colors.amber, 0.1) },
  check: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  rir: { flex: 1, height: 44, borderRadius: radius.sm, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  rirOn: { backgroundColor: colors.cyan },
  toggle: { paddingHorizontal: space.lg, height: 36, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.hairline, justifyContent: 'center' },
  notes: { minHeight: 70, borderRadius: radius.md, backgroundColor: colors.surface, color: colors.text, padding: space.md, fontSize: 15 },
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.lg, paddingTop: space.sm, gap: space.sm, backgroundColor: alpha('#000000', 0.88) },
});

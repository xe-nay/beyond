import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, ScrollView, View } from 'react-native';

import { Icon } from '../src/components/Icon';
import { Button, Chip, Press, Row, T } from '../src/components/ui';
import { TEMPLATES } from '../src/domain/program';
import { dayLabel } from '../src/meals';
import { today, useStore, type Period } from '../src/store';
import { alpha, colors, radius, space } from '../src/theme';

const LENGTHS = [{ weeks: 4, label: '4 weeks' }, { weeks: 6, label: '6 weeks' }, { weeks: 8, label: '8 weeks' }, { weeks: 12, label: '12 weeks' }, { weeks: 0, label: 'Ongoing' }];

const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + n);
  return today(d);
};

/** Pick a program and the period it plans. Workouts already planned in that period are replaced only after asking. */
export default function Templates() {
  const router = useRouter();
  const s = useStore();
  const now = today();
  const monday = addDays(now, (7 - ((new Date(`${now}T12:00:00`).getDay() + 6) % 7)) % 7 || 7);
  const [start, setStart] = useState(now);
  const [weeks, setWeeks] = useState(8);
  const period: Period = { from: start, until: weeks ? addDays(start, weeks * 7 - 1) : null };

  const confirm = (go: () => void) => {
    const clash = s.sessions.filter((x) => !x.startedAt && x.date >= period.from && (period.until === null || x.date <= period.until));
    if (!clash.length) return go();
    const first = clash.map((x) => x.date).sort()[0];
    const last = clash.map((x) => x.date).sort().pop()!;
    const message = `${clash.length} planned workout${clash.length === 1 ? '' : 's'} between ${dayLabel(first)} and ${dayLabel(last)} would be replaced by this program. Planned cardio stays.`;
    const replace = () => { s.clearPlanned(period.from, period.until); go(); };
    if (Platform.OS === 'web') return window.confirm(message) ? replace() : undefined;
    Alert.alert('Replace your planned workouts?', message, [{ text: 'Cancel', style: 'cancel' }, { text: 'Replace', style: 'destructive', onPress: replace }]);
  };
  const pick = (create: () => void) => confirm(() => { create(); router.back(); });

  return (
    <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.md }}>
      <T v="title">Build a program</T>

      <View style={{ gap: space.sm }}>
        <T v="caption" color={colors.faint}>Starts</T>
        <Row gap={space.sm}>
          <Chip label="Today" active={start === now} onPress={() => setStart(now)} />
          <Chip label={`Monday ${new Date(`${monday}T12:00:00`).getDate()}`} active={start === monday} onPress={() => setStart(monday)} />
        </Row>
        <T v="caption" color={colors.faint}>For</T>
        <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
          {LENGTHS.map((l) => <Chip key={l.weeks} label={l.label} active={weeks === l.weeks} onPress={() => setWeeks(l.weeks)} />)}
        </Row>
        <T v="footnote" color={colors.dim}>{dayLabel(period.from)} → {period.until ? dayLabel(period.until) : 'no end'}</T>
      </View>

      <Button icon="wand.and.stars" title="Build from my profile" onPress={() => pick(() => s.generate(period))} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {TEMPLATES.map((t) => (
          <Press key={t.id} onPress={() => pick(() => s.useTemplate(t.id, period))} style={{ width: '48.5%' as any, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface2, gap: 4 }}>
            <T v="headline">{t.name}</T>
            <T v="label" color={colors.dim}>{t.detail}</T>
          </Press>
        ))}
      </View>
      {s.programs.length > 1 && (
        <View style={{ gap: space.sm, marginTop: space.md }}>
          <T v="caption" color={colors.faint}>Saved</T>
          {s.programs.map((p) => (
            <Press key={p.id} onPress={() => { s.set({ activeProgram: p.id }); router.back(); }}>
              <Row style={{ padding: space.md, borderRadius: radius.md, backgroundColor: p.id === s.activeProgram ? alpha(colors.cyan, 0.1) : colors.surface2 }}>
                <View style={{ flex: 1 }}>
                  <T v="headline">{p.name}</T>
                  {(p.from || p.until) && <T v="footnote" color={colors.faint}>{p.from ? dayLabel(p.from) : ''} → {p.until ? dayLabel(p.until) : 'no end'}</T>}
                </View>
                <T v="label" color={colors.dim}>{p.days.length} days</T>
                {p.id === s.activeProgram && <Icon name="checkmark" size={14} color={colors.cyan} />}
              </Row>
            </Press>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

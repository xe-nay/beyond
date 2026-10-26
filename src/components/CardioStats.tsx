import { View } from 'react-native';

import { sessionMinutes } from '../domain/calc';
import { averagePace, fitness, guidelineMinutes, insights, kcal, loadReport, sessionLoad } from '../domain/cardioStats';
import { formatClock } from '../domain/intervals';
import { formatPace } from '../domain/track';
import { latestWeight, useStore } from '../store';
import { alpha, colors, space, type } from '../theme';
import { BarChart } from './Charts';
import { Icon } from './Icon';
import { Card, Row, Section, Stat, T } from './ui';

const DAY = 86400000;

/**
 * Cardio in Stats: the period's totals, the week against the WHO guideline, pace and fitness, training
 * load, and what it adds up to. The maths and its sources are in src/domain/cardioStats.ts.
 */
export function CardioStats({ range, monday, weeks, labels }: { range: number[]; monday: number; weeks: number[]; labels: string[] }) {
  const s = useStore();
  const weight = latestWeight(s);
  const done = s.cardio.filter((c) => c.completed);
  if (!done.length) {
    return (
      <Section title="Cardio">
        <Card><T v="label" color={colors.dim}>No cardio logged yet. Guided sessions and ones logged by hand show here, with your pace, fitness and weekly minutes.</T></Card>
      </Section>
    );
  }
  const t = (d: string) => Date.parse(`${d}T12:00:00`);
  const inRange = done.filter((c) => t(c.date) >= range[0] && t(c.date) < range[1]);
  const minutes = inRange.reduce((n, c) => n + c.minutes, 0);
  const km = inRange.reduce((n, c) => n + (c.distanceKm ?? 0), 0);
  const energy = Math.round(inRange.reduce((n, c) => n + kcal(c, weight), 0));
  const week = guidelineMinutes(done, monday, monday + 7 * DAY);
  const now = Date.now();
  const pace = { now: averagePace(done, 'Running', now - 28 * DAY, now + DAY), before: averagePace(done, 'Running', now - 56 * DAY, now - 28 * DAY) };
  const fit = fitness(done);
  const loads = [
    ...done.map((c) => ({ date: c.date, load: sessionLoad(c.minutes, c.rpe) })),
    ...s.sessions.filter((x) => x.finishedAt).map((x) => ({ date: x.date, load: (sessionMinutes(x) ?? 0) * (x.sessionRpe ?? 5) })),
  ];
  const load = loadReport(loads, new Date());
  const notes = insights({ week, load, pace, fit, activeWeeks: weeks.filter((m) => m > 0).length });
  const share = Math.min(1, week.equivalent / 300);

  return (
    <Section title="Cardio">
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Stat small label="Sessions" value={inRange.length} />
          <Stat small label="Time" value={minutes >= 120 ? (minutes / 60).toFixed(1) : minutes} unit={minutes >= 120 ? 'h' : 'min'} />
          <Stat small label="Distance" value={km ? km.toFixed(1) : '—'} unit={km ? 'km' : undefined} />
          <Stat small label="Energy" value={energy || '—'} unit={energy ? 'kcal' : undefined} />
        </Row>
      </Card>

      {/* This week against the WHO range: 150 is the target, 300 the upper end */}
      <Card style={{ gap: space.sm }}>
        <Row style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
          <T v="headline">This week</T>
          <T v="headline" color={week.equivalent >= 150 ? colors.lime : colors.text} style={type.num}>{Math.round(week.equivalent)} <T v="footnote" color={colors.dim}>/ 150 min</T></T>
        </Row>
        <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.surface3, overflow: 'hidden' }}>
          <View style={{ width: `${share * 100}%`, height: 10, borderRadius: 5, backgroundColor: week.equivalent >= 150 ? colors.lime : colors.cyan }} />
          <View style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, backgroundColor: colors.black }} />
        </View>
        <T v="footnote" color={colors.faint}>{week.moderate} min moderate + {week.vigorous} min vigorous (×2). WHO: 150–300 min a week; the mark is 150.</T>
      </Card>

      <Card><BarChart data={weeks} labels={labels} color={colors.lime} format={(v) => `${v} min`} /></Card>

      <Card style={{ gap: space.md }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Stat small label="Fitness (VDOT)" value={fit ? fit.vdot : '—'} color={fit ? colors.cyan : undefined} />
          <Stat small label="5 km" value={fit ? formatClock(fit.fiveK * 60) : '—'} />
          <Stat small label="10 km" value={fit ? formatClock(fit.tenK * 60) : '—'} />
          <Stat small label="Run pace" value={pace.now ? formatPace(pace.now) : '—'} unit={pace.now ? '/km' : undefined} />
        </Row>
        <T v="footnote" color={colors.faint}>
          {fit ? `From ${fit.run.distanceKm} km in ${fit.run.minutes} min on ${fit.run.date} (Daniels VDOT; race times by Riegel).` : 'VDOT and race times need a hard continuous run of 1.5 km or more with its distance.'} Run pace: average over the last 4 weeks.
        </T>
      </Card>

      {load.ratio !== null || load.monotony !== null ? (
        <Card style={{ gap: space.md }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Stat small label="Load this week" value={Math.round(load.acute)} />
            <Stat small label="4-week avg" value={load.chronic} />
            <Stat small label="Ratio" value={load.ratio ?? '—'} color={load.ratio === null ? undefined : load.ratio > 1.3 ? colors.amber : load.ratio < 0.8 ? colors.dim : colors.lime} />
            <Stat small label="Monotony" value={load.monotony ?? '—'} color={load.monotony && load.monotony > 2 ? colors.amber : undefined} />
          </Row>
          <T v="footnote" color={colors.faint}>Load = minutes × effort, lifting and cardio together (session RPE). Ratio: this week against the 4 before; about 0.8–1.3 is the usual range.</T>
        </Card>
      ) : null}

      <Card style={{ gap: space.md }}>
        <T v="headline">What it means</T>
        {notes.map((n, i) => (
          <Row key={i} style={{ alignItems: 'flex-start' }}>
            <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(n.tone === 'good' ? colors.lime : n.tone === 'watch' ? colors.amber : colors.cyan, 0.14) }}>
              <Icon name={n.tone === 'good' ? 'checkmark' : n.tone === 'watch' ? 'exclamationmark' : 'info'} size={12} color={n.tone === 'good' ? colors.lime : n.tone === 'watch' ? colors.amber : colors.cyan} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T v="callout" style={{ fontWeight: '600' }}>{n.title}</T>
              <T v="footnote" color={colors.dim}>{n.detail}</T>
            </View>
          </Row>
        ))}
        <T v="caption" color={colors.faint} style={{ textTransform: 'none', letterSpacing: 0 }}>Sources: WHO 2020 activity guidelines · Foster 2001 session RPE · Gabbett 2016 load ratio · Daniels & Gilbert VDOT · Riegel 1977 · Compendium of Physical Activities. Estimates, not a medical test.</T>
      </Card>
    </Section>
  );
}

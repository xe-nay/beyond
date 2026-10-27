import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { exercises } from '../src/catalog';
import { Icon } from '../src/components/Icon';
import { Button, Card, Row, Segmented, T, Toggle } from '../src/components/ui';
import { applyChoices, needsChoice, parseTrainingFile, type Choice, type ImportResult, type ImportRow } from '../src/domain/importer';
import { IMPORT_GUIDE } from '../src/importGuide';
import { readUri } from '../src/storage';
import { useStore } from '../src/store';
import { alpha, colors, plural, space } from '../src/theme';

/** One dated file for plans and history: past entries with results become history, the rest the plan. */
export default function Import() {
  const router = useRouter();
  const s = useStore();
  const [result, setResult] = useState<ImportResult | null>(null);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [mode, setMode] = useState<'keep' | 'replace'>('keep');
  // Clashes: settled all at once, or day by day (with a jump to each one).
  const [how, setHow] = useState<'all' | 'each'>('all');
  const [onlyClashes, setOnlyClashes] = useState(false);
  const scroll = useRef<ScrollView>(null);
  // Where the list sits in the page: the result block, then the list within it.
  const blockY = useRef(0);
  const listY = useRef(0);
  const rowY = useRef<Record<string, number>>({});
  const [at, setAt] = useState(-1);
  const [copied, setCopied] = useState<'guide' | 'names' | null>(null);

  const read = (text: string) => {
    setChoices({});
    setMode('keep');
    setHow('all');
    setOnlyClashes(false);
    setAt(-1);
    setResult(parseTrainingFile(text, exercises, { sessions: s.sessions, cardio: s.cardio }));
  };
  const pick = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
    if (!r.canceled) read(await readUri(r.assets[0].uri));
  };
  const paste = async () => read(await Clipboard.getStringAsync());
  const copy = async (what: 'guide' | 'names') => {
    await Clipboard.setStringAsync(what === 'guide' ? IMPORT_GUIDE : exercises.map((e) => e.name).join('\n'));
    setCopied(what);
  };

  const plan = result && !result.errors.length ? applyChoices(result, choices, mode) : null;
  const count = plan ? plan.sessions.length + plan.cardio.length : 0;
  const conflicts = mode === 'keep' ? result?.rows.filter(needsChoice) ?? [] : [];
  const period = result?.period;
  const days = period ? Math.round((Date.parse(period.until) - Date.parse(period.from)) / 86400000) + 1 : 0;
  const nice = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const removing = result?.plannedInPeriod ?? [];
  // A day imported before can only be kept or replaced, so "both" updates it.
  const fit = (r: ImportRow, c: Choice): Choice => (r.status === 'changed' && c === 'both' ? 'import' : c);
  /** Scrolls to the clash after the one last shown (wraps to the first). */
  const nextClash = () => {
    if (!conflicts.length) return;
    const i = (at + 1) % conflicts.length;
    setAt(i);
    const y = rowY.current[conflicts[i].id];
    if (y !== undefined) scroll.current?.scrollTo({ y: Math.max(0, blockY.current + listY.current + y - 120), animated: true });
  };
  const chooseAll = (c: Choice) => setChoices(Object.fromEntries(conflicts.map((r) => [r.id, fit(r, c)])));
  const picked = conflicts.map((r) => choices[r.id] ?? 'mine');
  const all = (['mine', 'import', 'both'] as Choice[]).find((c) => conflicts.length && conflicts.every((r, i) => picked[i] === fit(r, c)));

  return (
    <ScrollView ref={scroll} contentContainerStyle={{ padding: space.xl, gap: space.lg }} keyboardShouldPersistTaps="handled">
      <T v="title">Import training</T>
      <T v="label" color={colors.dim}>Plans and past workouts from one JSON file or a reply copied from an AI chat. Nothing already in the app is deleted.</T>
      <Row gap={space.sm}>
        <Button icon="doc.on.clipboard" title="Paste" kind={result ? 'secondary' : 'primary'} onPress={paste} style={{ flex: 1 }} />
        <Button icon="doc.badge.plus" title="File" kind="secondary" onPress={pick} style={{ flex: 1 }} />
      </Row>

      {result && (
        <Animated.View entering={FadeIn.duration(200)} style={{ gap: space.md }} onLayout={(e) => { blockY.current = e.nativeEvent.layout.y; }}>
          {result.errors.length > 0 ? (
            <Card style={{ borderColor: colors.amber }}>
              <Row><Icon name="exclamationmark.triangle.fill" color={colors.amber} size={18} /><T v="headline">Nothing imported</T></Row>
              {result.errors.slice(0, 8).map((e, i) => <T key={i} v="label" color={colors.dim}>{e}</T>)}
            </Card>
          ) : (
            <>
              {period && (
                <Card style={{ gap: space.md }}>
                  <View style={{ gap: 2 }}>
                    <T v="caption" color={colors.faint}>This file covers</T>
                    <T v="title3">{nice(period.from)} – {nice(period.until)} <T v="footnote" color={colors.dim}>· {plural(days, 'day')}</T></T>
                  </View>
                  <Segmented<'keep' | 'replace'>
                    value={mode}
                    onChange={setMode}
                    options={[{ value: 'replace', label: 'Replace this period' }, { value: 'keep', label: 'Keep what is there' }]}
                  />
                  <T v="footnote" color={colors.dim}>
                    {mode === 'replace'
                      ? `Everything planned between these dates is removed${removing.length ? ` (${plural(removing.length, 'planned session')})` : ''} and the file's plan goes in. Days with nothing in the file become rest days.${result.doneInPeriod ? ` Your ${plural(result.doneInPeriod, 'logged session')} ${result.doneInPeriod === 1 ? 'stays' : 'stay'}.` : ' Logged workouts always stay.'}`
                      : 'Your plans stay. Where a day already has something, choose below: yours, the import, or both.'}
                  </T>
                  {mode === 'replace' && plan?.rest.days.length ? <T v="footnote" color={colors.cyan}>{plural(plan.rest.days.length, 'rest day')} in this period</T> : null}
                </Card>
              )}
              {conflicts.length > 0 && (
                <Card style={{ gap: space.md, borderColor: alpha(colors.amber, 0.5) }}>
                  <Row>
                    <Icon name="exclamationmark.triangle.fill" size={16} color={colors.amber} />
                    <View style={{ flex: 1 }}>
                      <T v="headline">{plural(conflicts.length, 'day')} clash with what you have</T>
                      <T v="footnote" color={colors.dim}>Yours stays unless you change it.</T>
                    </View>
                  </Row>
                  <Segmented<'all' | 'each'> value={how} onChange={setHow} options={[{ value: 'all', label: 'All at once' }, { value: 'each', label: 'Day by day' }]} />
                  {how === 'all' ? (
                    <View style={{ gap: 6 }}>
                      <Segmented<Choice | 'mixed'>
                        value={all ?? 'mixed'}
                        onChange={(c) => c !== 'mixed' && chooseAll(c)}
                        options={[{ value: 'mine', label: 'All mine' }, { value: 'import', label: 'All import' }, { value: 'both', label: 'All both' }]}
                      />
                      <T v="footnote" color={colors.faint}>
                        {all === 'mine' || !all ? 'Mine: the import skips these days.' : all === 'import' ? 'Import: the file replaces what these days had.' : 'Both: the day keeps yours and adds the import.'}
                        {all === 'both' && conflicts.some((r) => r.status === 'changed') ? ' Entries imported before are updated, not doubled.' : ''}
                      </T>
                    </View>
                  ) : (
                    <View style={{ gap: space.sm }}>
                      <Row gap={space.sm}>
                        <Button small icon="arrow.down.circle" title={at < 0 ? 'Go to the first clash' : `Next clash · ${at + 1}/${conflicts.length}`} onPress={nextClash} style={{ flex: 1 }} />
                      </Row>
                      <Row style={{ justifyContent: 'space-between' }}>
                        <T v="callout">Show only clashing days</T>
                        <Toggle value={onlyClashes} onChange={setOnlyClashes} />
                      </Row>
                      <T v="footnote" color={colors.faint}>Clashing days are marked in amber below, each with Mine, Import or Both.</T>
                    </View>
                  )}
                </Card>
              )}
              <View onLayout={(e) => { listY.current = e.nativeEvent.layout.y; }}>
              <Card style={{ padding: 0, gap: 0 }}>
                {result.rows.filter((r) => !(onlyClashes && how === 'each') || needsChoice(r)).map((r, i) => (
                  <View key={r.id} onLayout={(e) => { rowY.current[r.id] = e.nativeEvent.layout.y; }}>
                    <Entry row={r} first={i === 0} ask={mode === 'keep' && how === 'each'} clash={mode === 'keep' && needsChoice(r)} current={at >= 0 && conflicts[at]?.id === r.id}
                      choice={choices[r.id] ?? 'mine'} onChoose={(c) => setChoices({ ...choices, [r.id]: c })} />
                  </View>
                ))}
              </Card>
              </View>
              <Button
                kind="lime" icon="checkmark" disabled={!count && !plan?.rest.days.length}
                title={mode === 'replace' ? `Replace with ${plural(count, 'session')}` : count ? `Import ${plural(count, 'entry', 'entries')}` : plan?.rest.days.length ? `Add ${plural(plan.rest.days.length, 'rest day')}` : 'Nothing new'}
                onPress={() => { s.importData(plan!.sessions, plan!.cardio, plan!.remove, plan!.rest); router.back(); }}
              />
            </>
          )}
        </Animated.View>
      )}

      <Card style={{ gap: space.md }}>
        <Row><Icon name="wand.and.stars" size={18} color={colors.cyan} /><T v="headline">Write it with an AI chat</T></Row>
        <T v="label" color={colors.dim}>Copy the guide into any AI chat, then describe your plan or past workouts with their dates. Copy the reply and tap Paste.</T>
        <Button icon={copied === 'guide' ? 'checkmark' : 'square.on.square'} kind="secondary" title={copied === 'guide' ? 'Guide copied' : 'Copy the guide'} onPress={() => copy('guide')} />
        <Button icon={copied === 'names' ? 'checkmark' : 'list.bullet'} kind="ghost" title={copied === 'names' ? `${exercises.length} names copied` : 'Copy exercise names'} onPress={() => copy('names')} />
      </Card>
    </ScrollView>
  );
}

const DECISION: Record<Choice, string> = { mine: 'Keeping yours', import: 'Using the import', both: 'Keeping both' };

function Entry({ row: r, first, choice, onChoose, ask: asking, clash, current }: { row: ImportRow; first: boolean; choice: Choice; onChoose: (c: Choice) => void; ask: boolean; clash?: boolean; current?: boolean }) {
  const ask = asking && needsChoice(r);
  return (
    <View style={{
      padding: space.md, gap: space.sm, borderTopWidth: first ? 0 : 0.5, borderTopColor: colors.hairline,
      borderLeftWidth: clash ? 3 : 0, borderLeftColor: colors.amber, backgroundColor: current ? alpha(colors.amber, 0.08) : clash ? alpha(colors.amber, 0.03) : 'transparent',
    }}>
      <Row>
        <Icon name={r.type === 'rest' ? 'bed.double.fill' : r.type === 'cardio' ? 'figure.run' : 'dumbbell.fill'} size={16} color={r.type === 'rest' ? colors.dim : r.kind === 'history' ? colors.lime : colors.cyan} />
        <View style={{ flex: 1 }}>
          <T v="headline" numberOfLines={1}>{r.name}</T>
          <T v="footnote" color={colors.dim}>{r.date} · {r.type === 'rest' ? 'Rest day' : r.kind === 'history' ? 'History' : 'Planned'}</T>
        </View>
        {r.status === 'same' && <T v="footnote" color={colors.faint}>Already in</T>}
        {clash && !ask && <T v="footnote" color={colors.amber}>{DECISION[choice]}</T>}
      </Row>
      {ask && (
        <>
          <T v="footnote" color={colors.amber}>
            {r.status === 'changed' ? 'Imported before with different data' : `In the app: ${r.clashes.map((c) => c.name).join(', ')}`}
          </T>
          <Segmented<Choice>
            value={choice}
            onChange={onChoose}
            options={r.status === 'changed'
              ? [{ value: 'mine', label: 'Keep mine' }, { value: 'import', label: 'Use import' }]
              : [{ value: 'mine', label: 'Mine' }, { value: 'import', label: 'Import' }, { value: 'both', label: 'Both' }]}
          />
        </>
      )}
    </View>
  );
}

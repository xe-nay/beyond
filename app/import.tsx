import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { exercises } from '../src/catalog';
import { Icon } from '../src/components/Icon';
import { Button, Card, Row, Segmented, T } from '../src/components/ui';
import { applyChoices, needsChoice, parseTrainingFile, type Choice, type ImportResult, type ImportRow } from '../src/domain/importer';
import { IMPORT_GUIDE } from '../src/importGuide';
import { readUri } from '../src/storage';
import { useStore } from '../src/store';
import { colors, plural, space } from '../src/theme';

/** One dated file for plans and history: past entries with results become history, the rest the plan. */
export default function Import() {
  const router = useRouter();
  const s = useStore();
  const [result, setResult] = useState<ImportResult | null>(null);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [copied, setCopied] = useState<'guide' | 'names' | null>(null);

  const read = (text: string) => {
    setChoices({});
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

  const plan = result && !result.errors.length ? applyChoices(result, choices) : null;
  const count = plan ? plan.sessions.length + plan.cardio.length : 0;
  const conflicts = result?.rows.filter(needsChoice) ?? [];
  // A day imported before can only be kept or replaced, so "both" updates it.
  const fit = (r: ImportRow, c: Choice): Choice => (r.status === 'changed' && c === 'both' ? 'import' : c);
  const chooseAll = (c: Choice) => setChoices(Object.fromEntries(conflicts.map((r) => [r.id, fit(r, c)])));
  const picked = conflicts.map((r) => choices[r.id] ?? 'mine');
  const all = (['mine', 'import', 'both'] as Choice[]).find((c) => conflicts.length && conflicts.every((r, i) => picked[i] === fit(r, c)));

  return (
    <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.lg }} keyboardShouldPersistTaps="handled">
      <T v="title">Import training</T>
      <T v="label" color={colors.dim}>Plans and past workouts from one JSON file or a reply copied from an AI chat. Nothing already in the app is deleted.</T>
      <Row gap={space.sm}>
        <Button icon="doc.on.clipboard" title="Paste" kind={result ? 'secondary' : 'primary'} onPress={paste} style={{ flex: 1 }} />
        <Button icon="doc.badge.plus" title="File" kind="secondary" onPress={pick} style={{ flex: 1 }} />
      </Row>

      {result && (
        <Animated.View entering={FadeIn.duration(200)} style={{ gap: space.md }}>
          {result.errors.length > 0 ? (
            <Card style={{ borderColor: colors.amber }}>
              <Row><Icon name="exclamationmark.triangle.fill" color={colors.amber} size={18} /><T v="headline">Nothing imported</T></Row>
              {result.errors.slice(0, 8).map((e, i) => <T key={i} v="label" color={colors.dim}>{e}</T>)}
            </Card>
          ) : (
            <>
              {conflicts.length > 0 && (
                <View style={{ gap: 4 }}>
                  <T v="headline" color={colors.amber}>{plural(conflicts.length, 'day')} already {conflicts.length === 1 ? 'has' : 'have'} logs</T>
                  <T v="label" color={colors.dim}>Choose for all at once, or for each day below. Yours stays unless you change it.</T>
                  <View style={{ gap: 6, marginTop: space.sm }}>
                    <T v="caption" color={colors.faint}>For every day</T>
                    <Segmented<Choice | 'mixed'>
                      value={all ?? 'mixed'}
                      onChange={(c) => c !== 'mixed' && chooseAll(c)}
                      options={[{ value: 'mine', label: 'All mine' }, { value: 'import', label: 'All import' }, { value: 'both', label: 'All both' }]}
                    />
                    {all === 'both' && conflicts.some((r) => r.status === 'changed') && (
                      <T v="footnote" color={colors.dim}>Entries imported before are updated to the new version, not doubled.</T>
                    )}
                  </View>
                </View>
              )}
              <Card style={{ padding: 0, gap: 0 }}>
                {result.rows.map((r, i) => (
                  <Entry key={r.id} row={r} first={i === 0} choice={choices[r.id] ?? 'mine'} onChoose={(c) => setChoices({ ...choices, [r.id]: c })} />
                ))}
              </Card>
              <Button
                kind="lime" icon="checkmark" disabled={!count}
                title={count ? `Import ${plural(count, 'entry', 'entries')}` : 'Nothing new'}
                onPress={() => { s.importData(plan!.sessions, plan!.cardio, plan!.remove); router.back(); }}
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

function Entry({ row: r, first, choice, onChoose }: { row: ImportRow; first: boolean; choice: Choice; onChoose: (c: Choice) => void }) {
  const ask = needsChoice(r);
  return (
    <View style={{ padding: space.md, gap: space.sm, borderTopWidth: first ? 0 : 0.5, borderTopColor: colors.hairline }}>
      <Row>
        <Icon name={r.type === 'cardio' ? 'figure.run' : 'dumbbell.fill'} size={16} color={r.kind === 'history' ? colors.lime : colors.cyan} />
        <View style={{ flex: 1 }}>
          <T v="headline" numberOfLines={1}>{r.name}</T>
          <T v="footnote" color={colors.dim}>{r.date} · {r.kind === 'history' ? 'History' : 'Planned'}</T>
        </View>
        {r.status === 'same' && <T v="footnote" color={colors.faint}>Already in</T>}
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

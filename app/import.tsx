import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { exercises } from '../src/catalog';
import { Icon } from '../src/components/Icon';
import { Button, Card, Row, T } from '../src/components/ui';
import { parseTrainingFile, type ImportResult } from '../src/domain/importer';
import { readUri } from '../src/storage';
import { useStore } from '../src/store';
import { colors, space } from '../src/theme';

/** One dated file for plans and history: past entries with results become history, the rest the plan. */
export default function Import() {
  const router = useRouter();
  const s = useStore();
  const [result, setResult] = useState<ImportResult | null>(null);

  const pick = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true });
    if (r.canceled) return;
    const text = await readUri(r.assets[0].uri);
    setResult(parseTrainingFile(text, exercises, { sessions: s.sessions, cardio: s.cardio }));
  };

  const fresh = result?.rows.filter((x) => x.status === 'new').length ?? 0;
  return (
    <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.lg }}>
      <T v="title">Import training</T>
      <T v="label" color={colors.dim}>A JSON file with dated strength and cardio entries. Entries with results go to your history; the others are planned on their date.</T>
      <Button icon="doc.badge.plus" title={result ? 'Choose another file' : 'Choose file'} kind={result ? 'secondary' : 'primary'} onPress={pick} />

      {result && (
        <Animated.View entering={FadeIn.duration(200)} style={{ gap: space.md }}>
          {result.errors.length > 0 ? (
            <Card style={{ borderColor: colors.amber }}>
              <Row><Icon name="exclamationmark.triangle.fill" color={colors.amber} size={18} /><T v="headline">Nothing imported</T></Row>
              {result.errors.slice(0, 8).map((e, i) => <T key={i} v="label" color={colors.dim}>{e}</T>)}
            </Card>
          ) : (
            <>
              <Card style={{ padding: 0, gap: 0 }}>
                {result.rows.map((r, i) => (
                  <Row key={i} style={{ padding: space.md, borderTopWidth: i ? 0.5 : 0, borderTopColor: colors.hairline }}>
                    <Icon name={r.type === 'cardio' ? 'figure.run' : 'dumbbell.fill'} size={16} color={r.kind === 'history' ? colors.lime : colors.cyan} />
                    <View style={{ flex: 1 }}>
                      <T v="headline" numberOfLines={1}>{r.name}</T>
                      <T v="label" color={colors.dim}>{r.date} · {r.kind === 'history' ? 'History' : 'Planned'}</T>
                    </View>
                    {r.status === 'same' && <T v="caption" color={colors.faint}>Already in</T>}
                  </Row>
                ))}
              </Card>
              <Button kind="lime" icon="checkmark" title={fresh ? `Import ${fresh} entr${fresh === 1 ? 'y' : 'ies'}` : 'Nothing new'} disabled={!fresh} onPress={() => { s.importData(result.sessions, result.cardio); router.back(); }} />
            </>
          )}
        </Animated.View>
      )}

      <Card style={{ gap: 6 }}>
        <T v="caption" color={colors.faint}>Format</T>
        <T v="label" color={colors.dim} style={{ fontFamily: 'Menlo' }}>{`{ "format": "beyond-training", "version": 1, "id": "week-1",
  "entries": [{ "id": "d1", "date": "2026-10-27", "type": "strength",
    "name": "Upper A", "exercises": [{ "exerciseId": "bench-press",
    "sets": 3, "minReps": 6, "maxReps": 10, "rir": 2, "restSeconds": 150 }] }] }`}</T>
        <T v="label" color={colors.dim}>Add "performed": {'{'} "sets": [...] {'}'} for past results, or "type": "cardio" with "intervals". Kinetic files work too. Export a ready template from Program → share.</T>
      </Card>
    </ScrollView>
  );
}

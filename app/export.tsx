import * as Clipboard from 'expo-clipboard';
import { Directory, File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useMemo, useState } from 'react';
import { ActionSheetIOS, Alert, Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Button, Chip, PageDots, Row, T } from '../src/components/ui';
import { A4, buildReport, reportHtml, reportText, type Page } from '../src/report';
import { today, useStore } from '../src/store';
import { colors, space } from '../src/theme';

const RANGES = [{ days: 7, label: '7 days' }, { days: 30, label: '30 days' }, { days: 90, label: '90 days' }, { days: 0, label: 'All' }];

/** Export everything logged as a PDF: preview the pages, then save, share or copy. */
export default function Export() {
  const s = useStore();
  const { width } = useWindowDimensions();
  const [days, setDays] = useState(30);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const to = today();
  const from = days ? today(new Date(Date.now() - (days - 1) * 86400000)) : '0000-01-01';
  const pages = useMemo(() => buildReport(s, from, to), [s.sessions, s.cardio, s.entries, s.intakes, s.body, from, to]);

  const W = width;
  const paper = Math.min(width - space.xl * 2 - 24, 380);
  const x = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    x.set(e.contentOffset.x);
    scheduleOnRN(setPage, Math.round(e.contentOffset.x / W));
  });

  const pdf = async () => (await Print.printToFileAsync({ html: reportHtml(pages), width: A4.w, height: A4.h })).uri;
  const name = `Beyond ${from === '0000-01-01' ? 'all' : from} to ${to}.pdf`;
  const run = async (what: 'save' | 'share' | 'copy') => {
    setBusy(true);
    setDone(null);
    try {
      if (what === 'copy') {
        await Clipboard.setStringAsync(reportText(pages));
        setDone('Copied as text');
      } else if (Platform.OS === 'web') {
        await Print.printAsync({ html: reportHtml(pages) });
      } else {
        const uri = await pdf();
        if (what === 'share') await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: name });
        else {
          // Saved in the app's own folder, which the Files app shows under On My iPhone > Beyond.
          const dir = new Directory(Paths.document, 'Exports');
          if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
          const dest = new File(dir, name);
          if (dest.exists) dest.delete();
          new File(uri).copy(dest);
          setDone('Saved to Files › On My iPhone › Beyond › Exports');
        }
      }
    } catch (e: any) {
      Alert.alert('Export failed', String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };
  const choose = () => {
    if (Platform.OS !== 'ios') return run('share');
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ['Save to Files', 'Share…', 'Copy as text', 'Cancel'], cancelButtonIndex: 3, title: `${pages.length} page${pages.length === 1 ? '' : 's'} · PDF` },
      (i) => { if (i < 3) run((['save', 'share', 'copy'] as const)[i]); },
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.black, paddingTop: space.xl, gap: space.lg }}>
      <View style={{ paddingHorizontal: space.xl, gap: space.md }}>
        <T v="title">Export</T>
        <Row gap={space.sm}>{RANGES.map((r) => <Chip key={r.days} label={r.label} active={days === r.days} onPress={() => { setDays(r.days); setPage(0); }} />)}</Row>
      </View>

      <Animated.FlatList
        key={`${from}-${pages.length}`}
        data={pages}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item, index }) => (
          <View style={{ width: W, alignItems: 'center', justifyContent: 'center' }}>
            <Sheet page={item} index={index} total={pages.length} width={paper} x={x} W={W} />
          </View>
        )}
        style={{ flexGrow: 0 }}
      />

      <View style={{ gap: space.sm }}>
        <PageDots count={pages.length} index={Math.min(page, pages.length - 1)} color={colors.cyan} />
        <T v="footnote" color={colors.faint} style={{ textAlign: 'center' }}>Page {Math.min(page, pages.length - 1) + 1} of {pages.length}</T>
      </View>

      <View style={{ paddingHorizontal: space.xl, gap: space.sm, marginTop: 'auto', paddingBottom: space.xxl }}>
        {!!done && <T v="footnote" color={colors.lime} style={{ textAlign: 'center' }}>{done}</T>}
        <Button kind="lime" icon="square.and.arrow.up" title={busy ? 'Preparing…' : 'Export PDF'} disabled={busy} onPress={choose} />
      </View>
    </View>
  );
}

/** One A4 page drawn small; neighbours turn away like cards as you swipe. */
function Sheet({ page, index, total, width, x, W }: { page: Page; index: number; total: number; width: number; x: SharedValue<number>; W: number }) {
  const k = width / A4.w;
  const turn = useAnimatedStyle(() => {
    const p = x.get() / W - index; // -1 … 0 … 1
    return {
      transform: [{ perspective: 900 }, { rotateY: `${interpolate(p, [-1, 0, 1], [38, 0, -38])}deg` }, { scale: interpolate(Math.abs(p), [0, 1], [1, 0.86]) }],
      opacity: interpolate(Math.abs(p), [0, 1], [1, 0.4]),
    };
  });
  const f = (pt: number) => ({ fontSize: pt * k * 1.33, lineHeight: pt * k * 1.33 * 1.3 });
  return (
    <Animated.View style={[styles.paper, { width, height: width * (A4.h / A4.w), paddingHorizontal: 40 * k, paddingTop: 36 * k }, turn]}>
      {page.lines.map((l, j) => {
        if (l.t === 'title') return <View key={j} style={{ marginBottom: 4 * k }}><Text style={[styles.title, f(17)]}>{l.text}</Text>{!!l.sub && <Text style={[styles.sub, f(9)]}>{l.sub}</Text>}</View>;
        if (l.t === 'h') return (
          <View key={j} style={[styles.h, { marginTop: 8 * k, paddingBottom: 3 * k }]}>
            <Text style={[styles.hText, f(11)]} numberOfLines={1}>{l.text}</Text>
            <Text style={[styles.hRight, f(9)]} numberOfLines={1}>{l.right}</Text>
          </View>
        );
        if (l.t === 'meta') return <Text key={j} style={[styles.meta, f(8.5)]} numberOfLines={2}>{l.text}</Text>;
        if (l.t === 'gap') return <View key={j} style={{ height: 6 * k }} />;
        const widths = page.widths[j] ?? [];
        return (
          <View key={j} style={[styles.row, { paddingVertical: 2.4 * k }]}>
            {l.cells.map((c, i) => (
              <Text key={i} numberOfLines={1} style={[l.head ? styles.head : l.dim ? styles.dim : styles.cell, f(l.head ? 8 : 9.5), { width: `${widths[i] ?? 100 / l.cells.length}%` }]}>{c}</Text>
            ))}
          </View>
        );
      })}
      <Text style={[styles.footer, f(8), { bottom: 18 * k }]}>Beyond · page {index + 1} of {total}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  paper: { backgroundColor: '#FFFFFF', borderRadius: 6, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  title: { fontWeight: '700', color: '#0B1220' },
  sub: { color: '#6B7280' },
  h: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#12B5C8' },
  hText: { fontWeight: '600', color: '#111827', flexShrink: 1 },
  hRight: { color: '#4B5563' },
  row: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB' },
  head: { fontWeight: '600', color: '#6B7280', textTransform: 'uppercase' },
  cell: { color: '#111827' },
  dim: { color: '#9CA3AF' },
  meta: { color: '#4B5563' },
  footer: { position: 'absolute', left: 0, right: 0, textAlign: 'center', color: '#9CA3AF' },
});

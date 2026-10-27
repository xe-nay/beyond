import { CameraView, useCameraPermissions, type BarcodeType } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, TextInput, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '../src/components/Icon';
import { Button, Press, Row, T } from '../src/components/ui';
import { fdcByBarcode } from '../src/domain/fdc';
import { upcName, type Named } from '../src/domain/upcitemdb';
import { lookupBarcode } from '../src/domain/nutrition';
import { useStore } from '../src/store';
import { alpha, colors, radius, space } from '../src/theme';

const TYPES: BarcodeType[] = ['ean13', 'ean8', 'upc_a', 'upc_e'];
const BOX = { w: 280, h: 170 };

type Phase = { kind: 'scanning' } | { kind: 'looking'; code: string } | { kind: 'missing'; code: string; name: string | null; brand?: string | null; image?: string | null } | { kind: 'offline'; code: string };

/** Variants of the same product code: iOS reports UPC-A as EAN-13 with a leading zero. */
const variants = (code: string) => [...new Set([code, code.length === 13 && code.startsWith('0') ? code.slice(1) : null, code.length === 12 ? `0${code}` : null].filter(Boolean) as string[])];

export default function Scan() {
  const { date, meal, mode } = useLocalSearchParams<{ date?: string; meal?: string; mode?: 'intake' }>();
  const intake = mode === 'intake';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [permission, request] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: 'scanning' });
  const [typed, setTyped] = useState<string | null>(null);
  const busy = useRef(false);

  const sweep = useSharedValue(0);
  useEffect(() => {
    if (!reduced) sweep.set(withRepeat(withTiming(1, { duration: 1600, easing: Easing.bezier(0.77, 0, 0.175, 1) }), -1, true));
  }, [reduced]);
  const line = useAnimatedStyle(() => ({ transform: [{ translateY: sweep.get() * (BOX.h - 4) }] }));

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) request();
  }, [permission]);

  const open = (id: string) => router.replace({ pathname: '/food/[id]', params: { id, date: date ?? '', meal: meal ?? '' } });

  const handle = async (raw: string) => {
    if (busy.current) return;
    busy.current = true;
    const code = raw.replace(/\D/g, '');
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    // Supplements are set up on their own sheet, which looks the product up itself.
    if (intake) {
      // A supplement already set up with this barcode opens as it is.
      const mine = useStore.getState().supplements.find((x) => x.barcode && variants(code).includes(x.barcode.replace(/\D/g, '')));
      return router.replace({ pathname: '/intake', params: mine ? { id: mine.id } : { code } });
    }
    const { foods, saveFood } = useStore.getState();
    // Anything scanned before opens instantly, also without a connection.
    const known = variants(code).map((c) => foods[c]).find(Boolean);
    if (known) return open(known.id);
    setPhase({ kind: 'looking', code });
    let offline = false;
    let name: string | null = null;
    for (const c of variants(code)) {
      const r = await lookupBarcode(c);
      if (r.status === 'found') {
        saveFood({ ...r.food, id: code, barcode: code });
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        return open(code);
      }
      if (r.status === 'offline') offline = true;
      if (r.status === 'incomplete') name = r.name;
    }
    // Second source: USDA's branded products, many with full vitamin and mineral labels.
    if (!offline) {
      const usda = await fdcByBarcode(code).catch(() => null);
      if (usda) {
        saveFood({ ...usda, id: code, barcode: code });
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        return open(code);
      }
    }
    // Third: a product directory with names from many countries (no values); it names the product for
    // the search and for creating it.
    let named: Named | null = null;
    if (!offline) named = await upcName(code).catch(() => null);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    setPhase(offline ? { kind: 'offline', code } : { kind: 'missing', code, name: name ?? named?.name ?? null, brand: named?.brand ?? null, image: named?.image ?? null });
  };

  const again = () => {
    busy.current = false;
    setPhase({ kind: 'scanning' });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      {permission?.granted && (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: TYPES }}
          onBarcodeScanned={phase.kind === 'scanning' ? (r) => handle(r.data) : undefined}
        />
      )}

      {/* Dimmed surround with a clear window */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={[styles.shade, { flex: 1 }]} />
        <View style={{ flexDirection: 'row', height: BOX.h }}>
          <View style={[styles.shade, { flex: 1 }]} />
          <View style={{ width: BOX.w, height: BOX.h }}>
            {(['tl', 'tr', 'bl', 'br'] as const).map((c) => <View key={c} style={[styles.corner, styles[c]]} />)}
            {phase.kind === 'scanning' && <Animated.View style={[styles.line, line]} />}
          </View>
          <View style={[styles.shade, { flex: 1 }]} />
        </View>
        <View style={[styles.shade, { flex: 1.3 }]} />
      </View>

      {/* Top controls */}
      <Row style={{ position: 'absolute', top: insets.top + space.sm, left: space.lg, right: space.lg, justifyContent: 'space-between' }}>
        <Press onPress={() => router.back()} style={styles.round}><Icon name="xmark" size={16} /></Press>
        <Row gap={space.sm}>
          <Press onPress={() => setTyped(typed === null ? '' : null)} style={styles.round}><Icon name="keyboard" size={16} /></Press>
          {Platform.OS !== 'web' && <Press onPress={() => setTorch(!torch)} style={[styles.round, torch && { backgroundColor: colors.cyan }]}><Icon name="flashlight.on.fill" size={16} color={torch ? colors.black : colors.text} /></Press>}
        </Row>
      </Row>

      {/* Bottom card: hint, progress or the outcome */}
      <View style={{ position: 'absolute', left: space.lg, right: space.lg, bottom: insets.bottom + space.lg, gap: space.md }}>
        {typed !== null && phase.kind === 'scanning' && (
          <Animated.View entering={FadeInDown.duration(200)} style={styles.card}>
            <TextInput autoFocus value={typed} onChangeText={setTyped} keyboardType="number-pad" placeholder="Barcode digits" placeholderTextColor={colors.faint} style={styles.input} onSubmitEditing={() => typed.length >= 8 && handle(typed)} />
            <Button title="Look up" disabled={(typed ?? '').length < 8} onPress={() => handle(typed!)} />
          </Animated.View>
        )}
        {phase.kind === 'scanning' && typed === null && (
          <View style={{ alignItems: 'center', gap: space.md }}>
            <T v="headline" color={colors.dim} style={{ textAlign: 'center' }}>{permission && !permission.granted ? 'Allow camera access in Settings' : intake ? 'Scan the supplement' : 'Point at a barcode'}</T>
            <Press onPress={() => (intake ? router.replace('/intake') : router.replace({ pathname: '/food-search', params: { date: date ?? '', meal: meal ?? '' } }))} style={styles.searchPill}>
              <Icon name={intake ? 'pencil' : 'magnifyingglass'} size={16} />
              <T v="headline">{intake ? 'No barcode? Add by name' : 'No barcode? Search food'}</T>
            </Press>
          </View>
        )}
        {phase.kind === 'looking' && (
          <Animated.View entering={reduced ? undefined : FadeIn.duration(150)} style={styles.card}>
            <Row><Icon name="barcode" size={20} color={colors.cyan} /><T v="headline" style={{ flex: 1 }}>{phase.code}</T><T v="label" color={colors.dim}>Looking up…</T></Row>
          </Animated.View>
        )}
        {phase.kind === 'missing' && (
          <Animated.View entering={reduced ? undefined : FadeInDown.duration(220)} style={styles.card}>
            <View style={{ gap: 4 }}>
              <T v="title">{phase.name ? 'Nutrition missing' : 'Not in the database'}</T>
              <T v="label" color={colors.dim}>{phase.name ? `${phase.name} has no nutrition facts yet.` : `No product for ${phase.code}.`} Find it by name and it will open instantly next time you scan it.</T>
            </View>
            <Button icon="magnifyingglass" title="Search by name" onPress={() => router.replace({ pathname: '/food-search', params: { barcode: phase.code, q: phase.name ?? '', date: date ?? '', meal: meal ?? '' } })} />
            <Button kind="secondary" icon="pencil" title="Create from the label" onPress={() => router.replace({ pathname: '/food-new', params: { barcode: phase.code, q: phase.name ?? '', brand: phase.brand ?? '', image: phase.image ?? '', date: date ?? '', meal: meal ?? '' } })} />
            <Button kind="ghost" title="Scan again" onPress={again} />
          </Animated.View>
        )}
        {phase.kind === 'offline' && (
          <Animated.View entering={reduced ? undefined : FadeInDown.duration(220)} style={styles.card}>
            <T v="title">No connection</T>
            <T v="label" color={colors.dim}>New products need the internet once. Foods you scanned before work offline.</T>
            <Button title="Try again" onPress={() => { busy.current = false; handle(phase.code); }} />
            <Button kind="secondary" title="Scan another" onPress={again} />
          </Animated.View>
        )}
      </View>
    </View>
  );
}

const C = 26;
const styles = StyleSheet.create({
  shade: { backgroundColor: alpha('#000000', 0.62) },
  corner: { position: 'absolute', width: C, height: C, borderColor: colors.cyan },
  tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 14 },
  tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 14 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 14 },
  br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 14 },
  line: { position: 'absolute', left: 12, right: 12, top: 2, height: 2, borderRadius: 1, backgroundColor: colors.cyan, shadowColor: colors.cyan, shadowOpacity: 0.9, shadowRadius: 8 },
  round: { width: 40, height: 40, borderRadius: 20, backgroundColor: alpha('#000000', 0.55), alignItems: 'center', justifyContent: 'center' },
  searchPill: { flexDirection: 'row', alignItems: 'center', gap: space.sm, height: 50, paddingHorizontal: space.xl, borderRadius: radius.pill, backgroundColor: alpha('#FFFFFF', 0.14), borderWidth: StyleSheet.hairlineWidth, borderColor: alpha('#FFFFFF', 0.25) },
  card: { backgroundColor: colors.surface2, borderRadius: radius.xl, padding: space.lg, gap: space.md },
  input: { height: 50, borderRadius: radius.md, backgroundColor: colors.surface3, color: colors.text, paddingHorizontal: space.md, fontSize: 20, fontWeight: '600', letterSpacing: 2 },
});

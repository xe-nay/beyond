import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Icon } from '../src/components/Icon';
import { Button, Card, Chip, Divider, Press, Row, Stepper, T, Toggle } from '../src/components/ui';
import { dsldLabel, searchDsld } from '../src/domain/dsld';
import { MICRO, MICROS } from '../src/domain/micros';
import { lookupProduct, searchProducts } from '../src/domain/nutrition';
import { doseMicros, doseNutrients, formatDose, supplementFromOff, UNITS } from '../src/domain/supplements';
import type { DoseUnit, Supplement } from '../src/domain/types';
import { uid, useStore } from '../src/store';
import { colors, radius, space, type } from '../src/theme';

const STEP: Record<DoseUnit, number> = { g: 0.5, mg: 50, ml: 1, capsule: 1, tablet: 1, scoop: 0.5, drop: 1 };
const pad = (n: number) => String(n).padStart(2, '0');

/** Set up a daily intake: from a scanned barcode (code), by name (nothing), or edit one (id). */
export default function IntakeSetup() {
  const { code, id } = useLocalSearchParams<{ code?: string; id?: string }>();
  const router = useRouter();
  const s = useStore();
  const existing = id ? s.supplements.find((x) => x.id === id) : undefined;
  const [x, setX] = useState<Supplement>(() => existing ?? {
    id: uid(), name: '', brand: null, image: null, barcode: code ?? null, dose: 1, unit: 'capsule', time: '08:00',
    per100: null, servingG: null, micros: [], createdAt: new Date().toISOString(),
  });
  const [state, setState] = useState<'idle' | 'looking' | 'missing' | 'offline'>(code && !existing ? 'looking' : 'idle');
  const [label, setLabel] = useState<string | null>(null);
  const [searching, setSearching] = useState(!code && !existing);
  const up = (patch: Partial<Supplement>) => setX((v) => ({ ...v, ...patch }));

  const look = async () => {
    if (!code) return;
    setState('looking');
    const r = await lookupProduct(code);
    if (r.status === 'offline') return setState('offline');
    const p = r.status === 'found' ? supplementFromOff(r.product) : null;
    if (!p) {
      // Second source: US supplement labels, which carry the barcode of many products.
      const hit = await searchDsld(code).then((h) => h[0]).catch(() => null);
      if (hit) {
        await pickDsld(hit.id);
        return setState('idle');
      }
      setSearching(true);
      return setState('missing');
    }
    // Powders default to grams, everything else to one unit a day.
    const powder = !!p.per100 && (p.servingG ?? 0) >= 2;
    setX((v) => ({ ...v, ...p, barcode: code, unit: powder ? 'g' : v.unit, dose: powder ? p.servingG! : v.dose }));
    setLabel(p.servingLabel);
    setState('idle');
  };
  useEffect(() => { look(); }, [code]);

  const pickDsld = async (labelId: string) => {
    const l = await dsldLabel(labelId);
    const u = l.servingUnit ?? '';
    const unit = (/capsule/i.test(u) ? 'capsule' : /tablet/i.test(u) ? 'tablet' : /scoop/i.test(u) ? 'scoop' : x.unit) as DoseUnit;
    setX((v) => ({ ...v, name: l.name, brand: l.brand, serving: l.serving, unit, dose: 1 }));
    setLabel(l.servingLabel);
    setSearching(false);
  };
  const pickOff = (product: any) => {
    const p = supplementFromOff(product);
    if (!p) return;
    const powder = !!p.per100 && (p.servingG ?? 0) >= 2;
    setX((v) => ({ ...v, ...p, barcode: v.barcode ?? p.barcode, unit: powder ? 'g' : v.unit, dose: powder ? p.servingG! : v.dose }));
    setLabel(p.servingLabel);
    setSearching(false);
  };
  const setValue = (key: string, amount: number | null) => {
    const custom = { ...(x.custom ?? {}) };
    if (amount === null) delete custom[key];
    else custom[key] = amount;
    up({ custom });
  };

  const [h, m] = (x.time ?? '08:00').split(':').map(Number);
  const nutrients = doseNutrients(x);
  const micros = doseMicros(x);
  const save = () => {
    s.saveSupplement({ ...x, name: x.name.trim() });
    router.back();
  };
  const remove = () => {
    const go = () => { s.deleteSupplement(x.id); router.back(); };
    if (Platform.OS === 'web') return go();
    Alert.alert(`Remove ${x.name}?`, 'Its reminders stop. Days you already ticked stay in your history.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: go },
    ]);
  };

  if (state === 'looking') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
        <ActivityIndicator color={colors.cyan} />
        <T v="label" color={colors.dim}>Looking up {code}…</T>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive">
      <T v="title">{existing ? 'Daily intake' : 'Add daily intake'}</T>
      {state !== 'idle' && (
        <Animated.View entering={FadeIn.duration(200)}>
          <Card style={{ borderColor: colors.amber }}>
            <T v="headline">{state === 'offline' ? 'No connection' : 'Not in the database'}</T>
            <T v="label" color={colors.dim}>{state === 'offline' ? 'Name it below, or try again with a connection.' : `Nothing found for ${code} in Open Food Facts or the NIH supplement labels. Search by name, or name it and type its label values.`}</T>
            {state === 'offline' && <Button kind="secondary" title="Try again" onPress={look} />}
          </Card>
        </Animated.View>
      )}

      {searching && state !== 'offline' && <SearchPanel initial={x.name} onOff={pickOff} onDsld={pickDsld} onClose={() => setSearching(false)} />}
      {!searching && !existing && (
        <Press onPress={() => setSearching(true)} haptic={false}>
          <Row gap={6}><Icon name="magnifyingglass" size={13} color={colors.cyan} /><T v="footnote" color={colors.cyan}>Search the databases by name</T></Row>
        </Press>
      )}

      <Row style={{ alignItems: 'center' }}>
        <View style={[styles.thumb, !!x.image && { backgroundColor: '#F3F5F9' }]}>
          {x.image ? <Image source={x.image} style={{ flex: 1 }} contentFit="contain" cachePolicy="disk" /> : <Icon name="pills.fill" size={24} color={colors.cyan} />}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <TextInput value={x.name} onChangeText={(name) => up({ name })} placeholder="Creatine, multivitamin…" placeholderTextColor={colors.faint} style={styles.name} />
          {!!x.brand && <T v="footnote" color={colors.dim}>{x.brand}</T>}
        </View>
      </Row>

      <View style={{ gap: space.sm }}>
        <T v="caption" color={colors.faint}>Daily dose</T>
        <Row><Stepper value={x.dose} onChange={(dose) => up({ dose })} step={STEP[x.unit]} min={STEP[x.unit]} max={x.unit === 'mg' ? 20000 : 500} format={() => formatDose(x)} big /></Row>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
          {UNITS.map((u) => <Chip key={u} label={u} active={x.unit === u} onPress={() => up({ unit: u, dose: u === x.unit ? x.dose : u === 'g' ? 5 : u === 'mg' ? 500 : u === 'ml' ? 5 : 1 })} />)}
        </ScrollView>
        {!!label && <T v="footnote" color={colors.faint}>Label serving: {label}</T>}
      </View>

      <Divider />
      <Row style={{ justifyContent: 'space-between' }}>
        <View>
          <T v="headline">Remind me every day</T>
          <T v="footnote" color={colors.dim}>Skipped once you tick it</T>
        </View>
        <Toggle value={x.time !== null} onChange={(on) => up({ time: on ? '08:00' : null })} />
      </Row>
      {x.time !== null && (
        <Animated.View entering={FadeIn.duration(180)} style={{ gap: space.sm }}>
          <T v="hero" style={[type.num, { textAlign: 'center', fontSize: 56, lineHeight: 64 }]}>{pad(h)}:{pad(m)}</T>
          <Row>
            <Stepper label="Hour" value={h} onChange={(v) => up({ time: `${pad(v)}:${pad(m)}` })} min={0} max={23} format={pad} />
            <Stepper label="Minute" value={m} onChange={(v) => up({ time: `${pad(h)}:${pad(v)}` })} step={5} min={0} max={55} format={pad} />
          </Row>
        </Animated.View>
      )}

      <Divider />
      <LabelValues
        values={micros}
        energy={nutrients && (nutrients.kcal > 0 || nutrients.protein > 0) ? `${nutrients.kcal} kcal · ${nutrients.protein} g protein` : null}
        custom={x.custom ?? {}}
        onChange={setValue}
      />

      <Button kind="lime" icon="checkmark" title={existing ? 'Save' : 'Add to daily intake'} disabled={!x.name.trim()} onPress={save} />
      {existing && <Button kind="ghost" title="Remove" onPress={remove} />}
    </ScrollView>
  );
}

/** Finds a supplement by name in Open Food Facts and the NIH label database. */
function SearchPanel({ initial, onOff, onDsld, onClose }: { initial: string; onOff: (p: any) => void; onDsld: (id: string) => void; onClose: () => void }) {
  const [q, setQ] = useState(initial);
  const [off, setOff] = useState<any[]>([]);
  const [nih, setNih] = useState<{ id: string; name: string; brand: string | null }[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (q.trim().length < 3) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setBusy(true);
      const [a, b] = await Promise.all([searchProducts(q.trim(), ctrl.signal).catch(() => []), searchDsld(q.trim(), ctrl.signal).catch(() => [])]);
      setOff(a.filter((p) => p.product_name).slice(0, 8));
      setNih(b.slice(0, 8));
      setBusy(false);
    }, 400);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);
  return (
    <Card style={{ gap: space.sm }}>
      <Row style={styles.search}>
        <Icon name="magnifyingglass" size={15} color={colors.dim} />
        <TextInput autoFocus value={q} onChangeText={setQ} placeholder="Creatine monohydrate, vitamin D…" placeholderTextColor={colors.faint} style={{ flex: 1, color: colors.text, fontSize: 16 }} />
        {busy ? <ActivityIndicator size="small" color={colors.dim} /> : <Press onPress={onClose} hitSlop={8}><Icon name="xmark" size={13} color={colors.faint} /></Press>}
      </Row>
      {off.map((p, i) => (
        <Press key={`o${i}`} onPress={() => onOff(p)} haptic={false}>
          <Row style={{ paddingVertical: 6 }}>
            <T v="footnote" color={colors.faint} style={{ width: 34 }}>OFF</T>
            <View style={{ flex: 1 }}>
              <T v="callout" numberOfLines={1}>{p.product_name}</T>
              {!!p.brands && <T v="footnote" color={colors.dim} numberOfLines={1}>{Array.isArray(p.brands) ? p.brands[0] : String(p.brands).split(',')[0]}</T>}
            </View>
          </Row>
        </Press>
      ))}
      {nih.map((h) => (
        <Press key={`n${h.id}`} onPress={() => onDsld(h.id)} haptic={false}>
          <Row style={{ paddingVertical: 6 }}>
            <T v="footnote" color={colors.cyan} style={{ width: 34 }}>NIH</T>
            <View style={{ flex: 1 }}>
              <T v="callout" numberOfLines={1}>{h.name}</T>
              {!!h.brand && <T v="footnote" color={colors.dim} numberOfLines={1}>{h.brand}</T>}
            </View>
          </Row>
        </Press>
      ))}
      {q.trim().length >= 3 && !busy && !off.length && !nih.length && <T v="footnote" color={colors.faint}>No match. Name it yourself and type its label values below.</T>}
    </Card>
  );
}

/** What one dose holds; any value can be typed or corrected, and more can be added. */
function LabelValues({ values, energy, custom, onChange }: {
  values: { key: string; label: string; amount: number; unit: string }[]; energy: string | null; custom: Record<string, number>; onChange: (key: string, v: number | null) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [text, setText] = useState('');
  const shown = [...values];
  if (editing && !shown.some((v) => v.key === editing)) shown.push({ key: editing, label: MICRO[editing].label, amount: 0, unit: MICRO[editing].unit });
  const commit = (key: string) => {
    const v = parseFloat(text.replace(',', '.'));
    onChange(key, Number.isFinite(v) && v > 0 ? v : null);
    setEditing(null);
  };
  return (
    <View style={{ gap: space.sm }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T v="caption" color={colors.faint}>In each dose</T>
        <Press onPress={() => setAdding(!adding)} hitSlop={8}>
          <Row gap={4}><Icon name={adding ? 'xmark' : 'plus'} size={12} color={colors.cyan} /><T v="footnote" color={colors.cyan}>{adding ? 'Close' : 'Add a value'}</T></Row>
        </Press>
      </Row>
      {adding && (
        <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
          {MICROS.filter((m) => !shown.some((v) => v.key === m.key)).map((m) => (
            <Chip key={m.key} label={m.label} onPress={() => { setAdding(false); setEditing(m.key); setText(''); }} />
          ))}
        </Row>
      )}
      <Card style={{ gap: 0, paddingVertical: space.sm }}>
        {!!energy && <Row style={styles.line}><T v="callout">Energy · protein</T><T v="callout" color={colors.dim} style={type.num}>{energy}</T></Row>}
        {shown.map((v) => (
          <Press key={v.key} onPress={() => { setEditing(v.key); setText(v.amount ? String(v.amount) : ''); }} haptic={false}>
            <Row style={styles.line}>
              <T v="callout">{v.label}</T>
              {editing === v.key ? (
                <Row gap={4}>
                  <TextInput autoFocus value={text} onChangeText={setText} onBlur={() => commit(v.key)} onSubmitEditing={() => commit(v.key)} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.faint} style={styles.value} />
                  <T v="callout" color={colors.dim}>{v.unit}</T>
                </Row>
              ) : (
                <T v="callout" color={custom[v.key] !== undefined ? colors.cyan : colors.dim} style={type.num}>{v.amount} {v.unit}</T>
              )}
            </Row>
          </Press>
        ))}
        {!energy && !shown.length && <T v="footnote" color={colors.faint} style={{ paddingVertical: 8 }}>No label values yet. Add what the label says per dose, for example Creatine 3 g.</T>}
      </Card>
      <T v="footnote" color={colors.faint}>Counted in the day's nutrition once ticked. Tap a value to correct it; your values show in cyan.</T>
    </View>
  );
}

const styles = StyleSheet.create({
  search: { height: 44, borderRadius: radius.md, backgroundColor: colors.surface3, paddingHorizontal: space.md },
  value: { minWidth: 80, textAlign: 'right', color: colors.cyan, fontSize: 17, fontWeight: '600', paddingVertical: 6, paddingHorizontal: 8, borderRadius: radius.sm, backgroundColor: colors.surface3 },
  thumb: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.surface2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  name: { color: colors.text, fontSize: 22, fontWeight: '700', paddingVertical: 4 },
  line: { justifyContent: 'space-between', paddingVertical: 8 },
});

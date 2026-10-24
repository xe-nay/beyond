import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';

import { Icon } from '../src/components/Icon';
import { Press, Row, T } from '../src/components/ui';
import { searchFoods } from '../src/domain/nutrition';
import type { Food } from '../src/domain/types';
import { useStore } from '../src/store';
import { colors, radius, space, type } from '../src/theme';

/** Reached only when a scanned barcode has no data. The chosen product is linked to that barcode. */
export default function FoodSearch() {
  const { barcode, q, date, meal } = useLocalSearchParams<{ barcode?: string; q?: string; date?: string; meal?: string }>();
  const router = useRouter();
  const s = useStore();
  const [query, setQuery] = useState(q ?? '');
  const [results, setResults] = useState<Food[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) return setResults([]);
    const t = setTimeout(async () => {
      ctrl.current?.abort();
      ctrl.current = new AbortController();
      setState('loading');
      try {
        setResults(await searchFoods(query.trim(), ctrl.current.signal));
        setState('idle');
      } catch (e: any) {
        if (e?.name !== 'AbortError') setState('error');
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  const local = Object.values(s.foods).filter((f) => query.length > 1 && f.name.toLowerCase().includes(query.toLowerCase()));
  const choose = (f: Food) => {
    // Remember the product under the scanned barcode so the next scan is instant.
    const id = barcode || f.id;
    s.saveFood({ ...f, id, barcode: barcode || f.barcode });
    router.replace({ pathname: '/food/[id]', params: { id, date: date ?? '', meal: meal ?? '' } });
  };

  return (
    <View style={{ flex: 1, padding: space.xl, gap: space.md }}>
      <T v="title">Find the product</T>
      <Row style={styles.search}>
        <Icon name="magnifyingglass" size={16} color={colors.dim} />
        <TextInput autoFocus value={query} onChangeText={setQuery} placeholder="Name or brand" placeholderTextColor={colors.faint} style={{ flex: 1, color: colors.text, fontSize: 17 }} returnKeyType="search" />
        {state === 'loading' && <T v="label" color={colors.dim}>…</T>}
      </Row>
      {state === 'error' && <T v="label" color={colors.amber}>Search needs a connection.</T>}
      <FlatList
        data={[...local, ...results.filter((r) => !local.some((l) => l.id === r.id))]}
        keyExtractor={(x, i) => `${x.id}-${i}`}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: 2, paddingBottom: space.xxl }}
        renderItem={({ item }) => (
          <Press onPress={() => choose(item)}>
            <Row style={{ paddingVertical: space.sm }}>
              <View style={styles.thumb}>{item.image ? <Image source={item.image} style={{ flex: 1 }} contentFit="contain" cachePolicy="disk" /> : <Icon name="fork.knife" size={16} color={colors.faint} />}</View>
              <View style={{ flex: 1 }}>
                <T v="headline" numberOfLines={1}>{item.name}</T>
                <T v="label" color={colors.dim} numberOfLines={1}>{item.brand ?? 'Unbranded'}</T>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <T v="headline" style={type.num}>{item.per100.kcal}</T>
                <T v="caption" color={colors.faint}>/100 {item.basis}</T>
              </View>
            </Row>
          </Press>
        )}
        ListEmptyComponent={query.length > 1 && state === 'idle' ? <T v="label" color={colors.faint}>No matches yet.</T> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  search: { height: 50, borderRadius: radius.md, backgroundColor: colors.surface2, paddingHorizontal: space.md },
  thumb: { width: 48, height: 48, borderRadius: 10, backgroundColor: '#F3F5F9', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});

import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';

import { Icon } from '../src/components/Icon';
import { Press, Row, T } from '../src/components/ui';
import { basicFoods, searchBasics } from '../src/basicFoods';
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

  const mine = Object.values(s.foods).filter((f) => query.length > 1 && f.name.toLowerCase().includes(query.toLowerCase()));
  const local = [...searchBasics(query), ...mine.filter((f) => !f.id.startsWith('usda-'))];
  const choose = (f: Food) => {
    // Remember the product under the scanned barcode so the next scan is instant.
    const id = barcode && !f.id.startsWith('usda-') ? barcode : f.id;
    s.saveFood({ ...f, id, barcode: barcode || f.barcode });
    router.replace({ pathname: '/food/[id]', params: { id, date: date ?? '', meal: meal ?? '' } });
  };

  // The list is the sheet's root: iOS stretches a sheet's first list over the whole sheet, so the title
  // and search field live in its sticky header instead of above it.
  return (
    <FlatList
      style={{ flex: 1 }}
      data={query.trim().length < 2
        ? [...Object.values(s.foods).sort((a, b) => b.lastUsed.localeCompare(a.lastUsed)).slice(0, 8), ...basicFoods.filter((b) => !s.foods[b.id])]
        : [...local, ...results.filter((r) => !local.some((l) => l.id === r.id))]}
      keyExtractor={(x, i) => `${x.id}-${i}`}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      stickyHeaderIndices={[0]}
      contentContainerStyle={{ paddingBottom: space.xxl }}
      ListHeaderComponent={
        <View style={styles.header}>
          <T v="title">{barcode ? 'Find the product' : 'Search food'}</T>
          <Row style={styles.search}>
            <Icon name="magnifyingglass" size={16} color={colors.dim} />
            <TextInput autoFocus value={query} onChangeText={setQuery} placeholder="Eggs, rice, chicken, a brand…" placeholderTextColor={colors.faint} style={{ flex: 1, color: colors.text, fontSize: 17 }} returnKeyType="search" />
            {state === 'loading' && <T v="label" color={colors.dim}>…</T>}
          </Row>
          {state === 'error' && <T v="label" color={colors.amber}>Search needs a connection.</T>}
        </View>
      }
      renderItem={({ item }) => (
        <Press onPress={() => choose(item)} style={{ paddingHorizontal: space.xl }}>
          <Row style={{ paddingVertical: space.sm }}>
            <View style={[styles.thumb, !!item.image && { backgroundColor: '#F3F5F9' }]}>
              {item.image ? <Image source={item.image} style={{ width: 48, height: 48 }} contentFit="contain" cachePolicy="disk" /> : <Icon name="fork.knife" size={18} color={colors.dim} />}
            </View>
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
      ListEmptyComponent={query.length > 1 && state === 'idle' ? <T v="label" color={colors.faint} style={{ paddingHorizontal: space.xl }}>No matches yet.</T> : null}
    />
  );
}

const styles = StyleSheet.create({
  header: { padding: space.xl, paddingBottom: space.md, gap: space.md, backgroundColor: colors.surface },
  search: { height: 50, borderRadius: radius.md, backgroundColor: colors.surface2, paddingHorizontal: space.md },
  thumb: { width: 48, height: 48, borderRadius: 10, backgroundColor: colors.surface2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});

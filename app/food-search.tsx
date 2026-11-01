import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, TextInput, View } from 'react-native';

import { Icon } from '../src/components/Icon';
import { Press, Row, T } from '../src/components/ui';
import { basicFoods, searchBasics } from '../src/basicFoods';
import { fdcSearch } from '../src/domain/fdc';
import { searchFoods, SearchError } from '../src/domain/nutrition';
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
  const [state, setState] = useState<'idle' | 'loading' | 'offline' | 'down'>('idle');
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setState('idle');
      return setResults([]);
    }
    const t = setTimeout(async () => {
      ctrl.current?.abort();
      ctrl.current = new AbortController();
      setState('loading');
      try {
        // Open Food Facts and USDA together; one of them failing still shows the other's results.
        const sig = ctrl.current.signal;
        const [off, usda] = await Promise.allSettled([searchFoods(query.trim(), sig), fdcSearch(query.trim(), sig)]);
        if (off.status === 'rejected' && usda.status === 'rejected') throw off.reason;
        setResults([...(off.status === 'fulfilled' ? off.value : []), ...(usda.status === 'fulfilled' ? usda.value : [])]);
        setState('idle');
      } catch (e: any) {
        if (e?.name !== 'AbortError') setState(e instanceof SearchError && e.kind === 'offline' ? 'offline' : 'down');
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  // Foods logged before come first, most recent first; typing filters them like everything else.
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (f: Food) => words.every((w) => `${f.name} ${f.brand ?? ''}`.toLowerCase().includes(w));
  const lastLogged = new Map<string, string>();
  for (const e of s.entries) if (!lastLogged.has(e.foodId) || `${e.date} ${e.time ?? ''}` > lastLogged.get(e.foodId)!) lastLogged.set(e.foodId, `${e.date} ${e.time ?? ''}`);
  const logged = [...lastLogged.keys()].map((id) => s.foods[id]).filter((f): f is Food => !!f && matches(f))
    .sort((a, b) => lastLogged.get(b.id)!.localeCompare(lastLogged.get(a.id)!));
  const searching = query.trim().length >= 2;
  const others = (searching ? [...searchBasics(query), ...Object.values(s.foods).filter((f) => matches(f) && !f.id.startsWith('usda-')), ...results] : basicFoods)
    .filter((f, i, all) => !lastLogged.has(f.id) && all.findIndex((x) => x.id === f.id) === i);
  type Item = { head: string } | { food: Food };
  const items: Item[] = [
    ...(logged.length ? [{ head: 'Logged before' }, ...logged.map((food) => ({ food }))] : []),
    ...(others.length ? [{ head: searching ? (logged.length ? 'More results' : 'Results') : 'Basic foods' }, ...others.map((food) => ({ food }))] : []),
  ];
  const choose = (f: Food) => {
    // Remember the product under the scanned barcode so the next scan is instant, a basic food too.
    const id = barcode || f.id;
    s.saveFood({ ...f, id, barcode: barcode || f.barcode });
    router.replace({ pathname: '/food/[id]', params: { id, date: date ?? '', meal: meal ?? '' } });
  };

  // The list is the sheet's root: iOS stretches a sheet's first list over the whole sheet, so the title
  // and search field live in its sticky header instead of above it.
  return (
    <FlatList
      style={{ flex: 1 }}
      data={items}
      keyExtractor={(x, i) => ('head' in x ? `h-${x.head}` : `${x.food.id}-${i}`)}
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
          {state === 'offline' && <T v="label" color={colors.amber}>No internet. Your foods and the basic foods still work.</T>}
          {state === 'down' && <T v="label" color={colors.amber}>Open Food Facts isn't answering right now. Try again in a minute, or create the food yourself.</T>}
        </View>
      }
      renderItem={({ item: it }) => {
        if ('head' in it) return <T v="caption" color={colors.faint} style={{ paddingHorizontal: space.xl, paddingTop: space.lg, paddingBottom: space.xs }}>{it.head}</T>;
        const item = it.food;
        return (
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
        );
      }}
      // Whatever the search found, a food can always be typed from its label.
      ListFooterComponent={
        <Press onPress={() => router.replace({ pathname: '/food-new', params: { barcode: barcode ?? '', q: query, date: date ?? '', meal: meal ?? '' } })} style={{ marginHorizontal: space.xl, marginTop: space.md, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.hairlineStrong }}>
          <T v="headline" color={colors.cyan} style={{ textAlign: 'center' }}>Can't find it? Create it from the label</T>
        </Press>
      }
      ListEmptyComponent={query.length > 1 && state === 'idle' ? <T v="label" color={colors.faint} style={{ paddingHorizontal: space.xl }}>No matches yet.</T> : null}
    />
  );
}

const styles = StyleSheet.create({
  header: { padding: space.xl, paddingBottom: space.md, gap: space.md, backgroundColor: colors.surface },
  search: { height: 50, borderRadius: radius.md, backgroundColor: colors.surface2, paddingHorizontal: space.md },
  thumb: { width: 48, height: 48, borderRadius: 10, backgroundColor: colors.surface2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});

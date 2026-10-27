import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Button, Chip, Row, T } from '../src/components/ui';
import type { Food } from '../src/domain/types';
import { uid, useStore } from '../src/store';
import { colors, radius, space, type } from '../src/theme';

const FIELDS: { key: string; label: string; unit: string; sub?: boolean; required?: boolean }[] = [
  { key: 'kcal', label: 'Energy', unit: 'kcal', required: true },
  { key: 'fat', label: 'Fat', unit: 'g', required: true },
  { key: 'satFat', label: 'Saturated', unit: 'g', sub: true },
  { key: 'carbs', label: 'Carbohydrates', unit: 'g', required: true },
  { key: 'sugar', label: 'Sugars', unit: 'g', sub: true },
  { key: 'fiber', label: 'Fibre', unit: 'g' },
  { key: 'protein', label: 'Protein', unit: 'g', required: true },
  { key: 'salt', label: 'Salt', unit: 'g' },
];

/** A food typed from its label, for products no database knows. Linked to the scanned barcode when there is one. */
export default function NewFood() {
  const { barcode, q, brand: knownBrand, image, date, meal } = useLocalSearchParams<{ barcode?: string; q?: string; brand?: string; image?: string; date?: string; meal?: string }>();
  const router = useRouter();
  const s = useStore();
  const [name, setName] = useState(q ?? '');
  const [brand, setBrand] = useState(knownBrand ?? '');
  const [basis, setBasis] = useState<'g' | 'ml'>('g');
  const [serving, setServing] = useState('');
  const [v, setV] = useState<Record<string, string>>({});
  const num = (k: string) => {
    const n = parseFloat((v[k] ?? '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };
  // Labels often give energy in kJ first; a value above 900 per 100 g is read as kJ.
  const kcal = num('kcal') !== null && num('kcal')! > 900 ? Math.round(num('kcal')! / 4.184) : num('kcal');
  const ready = name.trim() && kcal !== null && FIELDS.every((f) => !f.required || num(f.key) !== null);

  const save = () => {
    const id = barcode || `custom-${uid()}`;
    const size = parseFloat(serving.replace(',', '.'));
    const food: Food = {
      id, barcode: barcode || null, name: name.trim(), brand: brand.trim() || null, image: image || null, basis,
      per100: { kcal: kcal!, protein: num('protein')!, carbs: num('carbs')!, fat: num('fat')!, sugar: num('sugar'), fiber: num('fiber'), satFat: num('satFat'), salt: num('salt') },
      servingSize: Number.isFinite(size) && size > 0 ? size : null, servingLabel: null, nutriScore: null, nova: null, favorite: false, lastUsed: new Date().toISOString(),
    };
    s.saveFood(food);
    router.replace({ pathname: '/food/[id]', params: { id, date: date ?? '', meal: meal ?? '' } });
  };

  return (
    <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.md, paddingBottom: 120 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive">
      <T v="title">Create food</T>
      <T v="footnote" color={colors.dim}>{barcode ? `Linked to ${barcode}: scanning it next time opens this food. ` : ''}Type the values per 100 {basis} from the label.</T>
      <TextInput value={name} onChangeText={setName} placeholder="Name" placeholderTextColor={colors.faint} style={styles.input} />
      <TextInput value={brand} onChangeText={setBrand} placeholder="Brand (optional)" placeholderTextColor={colors.faint} style={styles.input} />
      <Row gap={space.sm}>
        <Chip label="Per 100 g" active={basis === 'g'} onPress={() => setBasis('g')} />
        <Chip label="Per 100 ml" active={basis === 'ml'} onPress={() => setBasis('ml')} />
      </Row>
      <View style={styles.panel}>
        {FIELDS.map((f) => (
          <Row key={f.key} style={{ justifyContent: 'space-between', paddingLeft: f.sub ? space.md : 0 }}>
            <T v={f.sub ? 'footnote' : 'callout'} color={f.sub ? colors.dim : colors.text}>{f.label}{f.required ? '' : ' (optional)'}</T>
            <Row gap={6}>
              <TextInput value={v[f.key] ?? ''} onChangeText={(t) => setV({ ...v, [f.key]: t })} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.faint} style={styles.value} />
              <T v="footnote" color={colors.dim} style={{ width: 30 }}>{f.unit}</T>
            </Row>
          </Row>
        ))}
        {kcal !== null && num('kcal')! > 900 && <T v="footnote" color={colors.cyan}>Read as kJ: {kcal} kcal</T>}
      </View>
      <Row style={{ justifyContent: 'space-between' }}>
        <T v="callout">Serving size (optional)</T>
        <Row gap={6}>
          <TextInput value={serving} onChangeText={setServing} keyboardType="decimal-pad" placeholder="—" placeholderTextColor={colors.faint} style={styles.value} />
          <T v="footnote" color={colors.dim} style={{ width: 30 }}>{basis}</T>
        </Row>
      </Row>
      <Button kind="lime" icon="checkmark" title="Save and add" disabled={!ready} onPress={save} />
      <T v="footnote" color={colors.faint} style={{ textAlign: 'center' }}>Saved on this iPhone only.</T>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Sized by padding, not a fixed height, so iOS keeps the text and placeholder centred.
  input: { paddingVertical: 13, borderRadius: radius.md, backgroundColor: colors.surface2, color: colors.text, paddingHorizontal: space.md, fontSize: 17 },
  panel: { backgroundColor: colors.surface2, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  value: { minWidth: 76, paddingVertical: 8, borderRadius: radius.sm, backgroundColor: colors.surface3, color: colors.text, textAlign: 'right', paddingHorizontal: 10, fontSize: 16, ...(type.num as object) },
});

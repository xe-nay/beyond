import { useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { Icon } from '../src/components/Icon';
import { Button, Press, Row, T } from '../src/components/ui';
import { TEMPLATES } from '../src/domain/program';
import { useStore } from '../src/store';
import { alpha, colors, radius, space } from '../src/theme';

export default function Templates() {
  const router = useRouter();
  const s = useStore();
  return (
    <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.md }}>
      <T v="title">Programs</T>
      <Button icon="wand.and.stars" title="Build from my profile" onPress={() => { s.generate(); router.back(); }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {TEMPLATES.map((t) => (
          <Press key={t.id} onPress={() => { s.useTemplate(t.id); router.back(); }} style={{ width: '48.5%' as any, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.surface2, gap: 4 }}>
            <T v="headline">{t.name}</T>
            <T v="label" color={colors.dim}>{t.detail}</T>
          </Press>
        ))}
      </View>
      {s.programs.length > 1 && (
        <View style={{ gap: space.sm, marginTop: space.md }}>
          <T v="caption" color={colors.faint}>Saved</T>
          {s.programs.map((p) => (
            <Press key={p.id} onPress={() => { s.set({ activeProgram: p.id }); router.back(); }}>
              <Row style={{ padding: space.md, borderRadius: radius.md, backgroundColor: p.id === s.activeProgram ? alpha(colors.cyan, 0.1) : colors.surface2 }}>
                <T v="headline" style={{ flex: 1 }}>{p.name}</T>
                <T v="label" color={colors.dim}>{p.days.length} days</T>
                {p.id === s.activeProgram && <Icon name="checkmark" size={14} color={colors.cyan} />}
              </Row>
            </Press>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

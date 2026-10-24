import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button, Press, Row, Stepper, T } from '../src/components/ui';
import { today, useStore } from '../src/store';
import { colors, radius, space } from '../src/theme';

function Scale({ label, value, onChange, low, high, invert }: { label: string; value: number; onChange: (v: number) => void; low: string; high: string; invert?: boolean }) {
  return (
    <View style={{ gap: space.sm }}>
      <Row style={{ justifyContent: 'space-between' }}><T v="caption" color={colors.faint}>{label}</T><T v="caption" color={colors.faint}>{low} → {high}</T></Row>
      <Row gap={6}>
        {[1, 2, 3, 4, 5].map((v) => {
          const good = invert ? v <= 2 : v >= 4;
          const on = v === value;
          return (
            <Press key={v} onPress={() => onChange(v)} style={{ flex: 1, height: 46, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? (good ? colors.lime : v === 3 ? colors.cyan : colors.amber) : colors.surface2 }}>
              <T v="headline" color={on ? colors.black : colors.dim}>{v}</T>
            </Press>
          );
        })}
      </Row>
    </View>
  );
}

export default function CheckIn() {
  const router = useRouter();
  const s = useStore();
  const prev = s.checks.find((c) => c.date === today());
  const [energy, setEnergy] = useState(prev?.energy ?? 3);
  const [soreness, setSoreness] = useState(prev?.soreness ?? 2);
  const [sleep, setSleep] = useState(prev?.sleepHours ?? 7.5);
  return (
    <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.xl }}>
      <T v="title">How do you feel?</T>
      <Scale label="Energy" value={energy} onChange={setEnergy} low="drained" high="great" />
      <Scale label="Soreness" value={soreness} onChange={setSoreness} low="none" high="very" invert />
      <Stepper label="Sleep (hours)" value={sleep} onChange={setSleep} step={0.5} min={0} max={14} format={(v) => v.toFixed(1)} />
      <Button title="Save" icon="checkmark" onPress={() => { s.saveCheck({ date: today(), energy, soreness, sleepHours: sleep }); router.back(); }} />
    </ScrollView>
  );
}

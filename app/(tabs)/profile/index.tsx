import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Alert, Platform, TextInput, View } from 'react-native';

import { Icon, type IconName } from '../../../src/components/Icon';
import { Card, Chip, Divider, Press, Row, Screen, Section, Segmented, T } from '../../../src/components/ui';
import type { Equipment, Experience, Goal } from '../../../src/domain/types';
import { cacheText, readUri } from '../../../src/storage';
import { useStore } from '../../../src/store';
import { colors, radius, space } from '../../../src/theme';

const GOALS: [Goal, string][] = [['hypertrophy', 'Muscle'], ['strength', 'Strength'], ['fat-loss', 'Fat loss'], ['recomposition', 'Recomp'], ['hybrid', 'Hybrid'], ['general', 'Fitness']];
const GEAR: [Equipment, string][] = [['barbell', 'Barbell'], ['dumbbell', 'Dumbbells'], ['kettlebell', 'Kettlebells'], ['cable', 'Cables'], ['machine', 'Machines'], ['band', 'Bands'], ['bodyweight', 'Bodyweight']];

export default function Profile() {
  const router = useRouter();
  const s = useStore();
  const p = s.profile;
  const [msg, setMsg] = useState<string | null>(null);

  const exportAll = async () => {
    const { ready, ...state } = useStore.getState();
    const data = Object.fromEntries(Object.entries(state).filter(([, v]) => typeof v !== 'function'));
    const uri = cacheText(`beyond-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ format: 'beyond-backup', ...data }));
    if (Platform.OS !== 'web') await Sharing.shareAsync(uri, { mimeType: 'application/json', UTI: 'public.json' });
  };
  const importAll = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
    if (r.canceled) return;
    try {
      const data = JSON.parse(await readUri(r.assets[0].uri));
      if (data.format !== 'beyond-backup') return setMsg('That file is not a Beyond backup.');
      const go = () => { s.replaceAll(data); setMsg('Backup restored.'); };
      if (Platform.OS === 'web') go();
      else Alert.alert('Replace all data?', 'Everything on this iPhone is replaced by the backup.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Restore', style: 'destructive', onPress: go }]);
    } catch {
      setMsg('Could not read that file.');
    }
  };

  return (
    <Screen>
      <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.cyanSoft, alignItems: 'center', justifyContent: 'center' }}>
          <T v="title" color={colors.cyan}>{(p.name || 'B').slice(0, 1).toUpperCase()}</T>
        </View>
        <TextInput defaultValue={p.name} placeholder="Name" placeholderTextColor={colors.faint} onEndEditing={(e) => s.setProfile({ name: e.nativeEvent.text })} style={{ flex: 1, color: colors.text, fontSize: 20, fontWeight: '600' }} />
      </Card>

      <Section title="Units">
        <Segmented options={[{ value: 'kg', label: 'Kilograms' }, { value: 'lb', label: 'Pounds' }]} value={p.unit} onChange={(unit) => s.setProfile({ unit: unit as any })} />
      </Section>

      <Section title="Goal">
        <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
          {GOALS.map(([g, l]) => <Chip key={g} label={l} active={p.goal === g} onPress={() => s.setProfile({ goal: g })} />)}
        </Row>
      </Section>
      <Section title="Experience">
        <Segmented options={[{ value: 'beginner', label: 'New' }, { value: 'intermediate', label: 'Regular' }, { value: 'advanced', label: 'Experienced' }]} value={p.experience} onChange={(v) => s.setProfile({ experience: v as Experience })} />
      </Section>
      <Section title="Equipment">
        <Row gap={space.sm} style={{ flexWrap: 'wrap' }}>
          {GEAR.map(([g, l]) => {
            const on = p.equipment.includes(g);
            return <Chip key={g} label={l} active={on} onPress={() => s.setProfile({ equipment: on ? p.equipment.filter((x) => x !== g) : [...p.equipment, g] })} />;
          })}
        </Row>
      </Section>

      <Card style={{ padding: 0, gap: 0 }}>
        <Item icon="timer" label="Rest timer & sounds" detail={`${s.timer.countdown ? `${s.timer.countdown}s countdown` : 'End tone only'}`} onPress={() => router.push('/timer-settings')} />
        <Divider />
        <Item icon="flame.fill" label="Nutrition targets" detail={`${s.targets.kcal} kcal`} onPress={() => router.push('/targets')} />
        <Divider />
        <Item icon="scalemass.fill" label="Body check" onPress={() => router.push('/body-entry')} />
        <Divider />
        <Item icon="doc.badge.plus" label="Import training file" onPress={() => router.push('/import')} />
      </Card>

      <Section title="Data">
        <Card style={{ padding: 0, gap: 0 }}>
          <Item icon="square.and.arrow.up" label="Export backup" onPress={exportAll} />
          <Divider />
          <Item icon="square.and.arrow.down" label="Restore backup" onPress={importAll} />
        </Card>
        {msg && <T v="label" color={colors.cyan} style={{ paddingHorizontal: 4 }}>{msg}</T>}
        <T v="caption" color={colors.faint} style={{ textTransform: 'none', letterSpacing: 0, paddingHorizontal: 4 }}>
          Everything is stored on this iPhone. Only barcode lookups go online.
        </T>
      </Section>

      <Section title="Credits">
        <Card style={{ gap: 6 }}>
          <T v="label" color={colors.dim}>Exercise data by RepDB (repdb.co)</T>
          <T v="label" color={colors.dim}>free-exercise-db, public domain</T>
          <T v="label" color={colors.dim}>Food data: Open Food Facts, ODbL</T>
          <T v="label" color={colors.dim}>Body map: react-native-body-highlighter, MIT</T>
        </Card>
      </Section>
    </Screen>
  );
}

function Item({ icon, label, detail, onPress }: { icon: IconName; label: string; detail?: string; onPress: () => void }) {
  return (
    <Press onPress={onPress} haptic={false}>
      <Row style={{ padding: space.lg }}>
        <View style={{ width: 30, height: 30, borderRadius: radius.sm, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={15} color={colors.cyan} />
        </View>
        <T v="headline" style={{ flex: 1 }}>{label}</T>
        {detail && <T v="label" color={colors.dim}>{detail}</T>}
        <Icon name="chevron.right" size={13} color={colors.faint} />
      </Row>
    </Press>
  );
}

import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Icon } from '../src/components/Icon';
import { Button, Press, Row, Stepper, T } from '../src/components/ui';
import { toDisplay, toKg } from '../src/domain/plates';
import { keepPhoto } from '../src/storage';
import { latestWeight, today, uid, useStore } from '../src/store';
import { colors, radius, space } from '../src/theme';

export default function BodyEntry() {
  const router = useRouter();
  const s = useStore();
  const unit = s.profile.unit;
  const last = [...s.body].reverse();
  const pick = (k: 'waistCm' | 'chestCm' | 'armCm' | 'thighCm', d: number) => last.find((b) => b[k])?.[k] ?? d;
  const [weight, setWeight] = useState(Math.round(toDisplay(latestWeight(s) ?? 75, unit) * 10) / 10);
  const [waist, setWaist] = useState(pick('waistCm', 80));
  const [chest, setChest] = useState(pick('chestCm', 100));
  const [arm, setArm] = useState(pick('armCm', 35));
  const [thigh, setThigh] = useState(pick('thighCm', 55));
  const [measure, setMeasure] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);

  const choose = async (camera: boolean) => {
    const opts = { mediaTypes: ['images'] as ImagePicker.MediaType[], quality: 0.8, allowsEditing: true, aspect: [3, 4] as [number, number] };
    const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (!r.canceled) setPhoto(r.assets[0].uri);
  };

  const save = () => {
    const id = uid();
    s.saveBody({
      id, date: today(), weightKg: toKg(weight, unit),
      waistCm: measure ? waist : null, chestCm: measure ? chest : null, armCm: measure ? arm : null, thighCm: measure ? thigh : null,
      photo: photo ? keepPhoto(photo, id) : null,
    });
    router.back();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.xl }}>
      <T v="title">Body check</T>
      <Stepper label={`Weight ${unit}`} value={weight} onChange={setWeight} step={0.1} min={20} max={500} big format={(v) => v.toFixed(1)} />
      <Press onPress={() => setMeasure(!measure)} haptic={false}>
        <Row style={{ justifyContent: 'center' }} gap={6}><Icon name="ruler.fill" size={14} color={colors.cyan} /><T v="label" color={colors.cyan}>{measure ? 'Hide measurements' : 'Add measurements (cm)'}</T></Row>
      </Press>
      {measure && (
        <View style={{ gap: space.lg }}>
          <Row><Stepper label="Waist" value={waist} onChange={setWaist} step={0.5} /><Stepper label="Chest" value={chest} onChange={setChest} step={0.5} /></Row>
          <Row><Stepper label="Arm" value={arm} onChange={setArm} step={0.5} /><Stepper label="Thigh" value={thigh} onChange={setThigh} step={0.5} /></Row>
        </View>
      )}
      <Row>
        {photo ? <Image source={photo} style={{ width: 90, height: 120, borderRadius: radius.md }} /> : null}
        <View style={{ flex: 1, gap: space.sm }}>
          <Button small kind="secondary" icon="camera.fill" title="Photo" onPress={() => choose(true)} />
          <Button small kind="secondary" icon="photo.fill" title="From library" onPress={() => choose(false)} />
          <T v="caption" color={colors.faint} style={{ textTransform: 'none', letterSpacing: 0 }}>Photos stay on this iPhone, inside Beyond.</T>
        </View>
      </Row>
      <Button kind="lime" title="Save" icon="checkmark" onPress={save} />
    </ScrollView>
  );
}

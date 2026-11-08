import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import { Icon } from '../src/components/Icon';
import { Button, Press, Row, Stepper, T } from '../src/components/ui';
import { toDisplay, toKg } from '../src/domain/plates';
import { keepPhoto } from '../src/storage';
import { latestWeight, today, uid, useStore } from '../src/store';
import { dayLabel } from '../src/meals';
import { colors, radius, space } from '../src/theme';

/** A new weigh-in, or (with `id`) one from the history to correct or delete. */
export default function BodyEntry() {
  const router = useRouter();
  const { id: editId } = useLocalSearchParams<{ id?: string }>();
  const s = useStore();
  const unit = s.profile.unit;
  const entry = editId ? s.body.find((b) => b.id === editId) : undefined;
  const last = [...s.body].reverse();
  const pick = (k: 'waistCm' | 'chestCm' | 'armCm' | 'thighCm', d: number) => (entry ? entry[k] : null) ?? last.find((b) => b[k])?.[k] ?? d;
  const [weight, setWeight] = useState(Math.round(toDisplay(entry?.weightKg ?? latestWeight(s) ?? 75, unit) * 10) / 10);
  const [waist, setWaist] = useState(pick('waistCm', 80));
  const [chest, setChest] = useState(pick('chestCm', 100));
  const [arm, setArm] = useState(pick('armCm', 35));
  const [thigh, setThigh] = useState(pick('thighCm', 55));
  const [measure, setMeasure] = useState(!!(entry && (entry.waistCm || entry.chestCm || entry.armCm || entry.thighCm)));
  const [photo, setPhoto] = useState<string | null>(entry?.photo ?? null);
  const [date, setDate] = useState(entry?.date ?? today());
  const shiftDay = (d: number) => {
    const x = new Date(`${date}T12:00:00`);
    x.setDate(x.getDate() + d);
    const next = today(x);
    if (next <= today()) setDate(next);
  };

  const choose = async (camera: boolean) => {
    const opts = { mediaTypes: ['images'] as ImagePicker.MediaType[], quality: 0.8, allowsEditing: true, aspect: [3, 4] as [number, number] };
    const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (!r.canceled) setPhoto(r.assets[0].uri);
  };

  const save = () => {
    const id = entry?.id ?? uid();
    s.saveBody({
      id, date, weightKg: toKg(weight, unit),
      waistCm: measure ? waist : null, chestCm: measure ? chest : null, armCm: measure ? arm : null, thighCm: measure ? thigh : null,
      // A photo already kept stays as it is; a new one is copied into the app.
      photo: photo ? (photo === entry?.photo ? photo : keepPhoto(photo, id)) : null,
    });
    router.back();
  };
  const remove = () => Alert.alert('Delete this weigh-in?', `${dayLabel(date)} · ${weight.toFixed(1)} ${unit}`, [
    { text: 'Keep', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => { s.deleteBody(entry!.id); router.back(); } },
  ]);

  return (
    <ScrollView contentContainerStyle={{ padding: space.xl, gap: space.xl }}>
      <T v="title">{entry ? 'Edit weigh-in' : 'Body check'}</T>
      {/* The day it was taken: earlier days can be filled in or corrected, never a future one. */}
      <Row style={{ justifyContent: 'center' }} gap={space.lg}>
        <Press onPress={() => shiftDay(-1)} hitSlop={10} label="Previous day"><Icon name="chevron.left" size={16} color={colors.cyan} /></Press>
        <T v="headline" style={{ minWidth: 140, textAlign: 'center' }}>{dayLabel(date)}</T>
        <Press onPress={() => shiftDay(1)} hitSlop={10} label="Next day" disabled={date >= today()}><Icon name="chevron.right" size={16} color={date >= today() ? colors.faint : colors.cyan} /></Press>
      </Row>
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
      <Button kind="lime" title={entry ? 'Save changes' : 'Save'} icon="checkmark" onPress={save} />
      {entry && <Button kind="danger" icon="trash" title="Delete entry" onPress={remove} />}
    </ScrollView>
  );
}

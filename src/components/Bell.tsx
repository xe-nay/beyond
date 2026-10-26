import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { daysLeft, dueNow, LOW_DAYS } from '../domain/supplements';
import { clock, today, useStore } from '../store';
import { colors } from '../theme';
import { Icon } from './Icon';
import { Press } from './ui';

/** The notification panel: a dot when a dose is waiting, a pack is low or a message is unread. */
export function Bell() {
  const router = useRouter();
  const s = useStore();
  const waiting = s.inbox.some((i) => !i.read)
    || dueNow(s.supplements, s.intakes, s.skipped, today(), clock()).length > 0
    || s.supplements.some((x) => { const d = daysLeft(x, s.intakes); return d !== null && d <= LOW_DAYS; });
  return (
    <Press onPress={() => router.push('/inbox')} hitSlop={10} label="Notifications">
      <View style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="bell" size={19} color={colors.text} />
        {waiting && <View style={{ position: 'absolute', top: 5, right: 6, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.amber, borderWidth: 1.5, borderColor: colors.black }} />}
      </View>
    </Press>
  );
}

import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { DayDetail, longDate, relative } from '../../src/components/DayDetail';
import { Screen, T } from '../../src/components/ui';
import { today } from '../../src/store';
import { colors, space } from '../../src/theme';

/** One day from a link (the import, a reminder): the same view Today shows when swiped to that day. */
export default function Day() {
  const { date } = useLocalSearchParams<{ date: string }>();
  return (
    <Screen>
      <Stack.Screen options={{ title: '' }} />
      <View style={{ gap: 2, marginTop: -space.sm }}>
        <T v="caption" color={date === today() ? colors.cyan : colors.faint}>{relative(date)}</T>
        <T v="largeTitle">{longDate(date)}</T>
      </View>
      <DayDetail date={date} />
    </Screen>
  );
}

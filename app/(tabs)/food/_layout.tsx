import { Stack } from 'expo-router';

import { screenOptions } from '../../../src/nav';

export default function Layout() {
  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ title: 'Food', headerLargeTitle: true }} />
    </Stack>
  );
}

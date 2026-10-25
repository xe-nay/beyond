import { DarkTheme, Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { LogBox, Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { RestEngine } from '../src/components/RestEngine';
import '../src/gps'; // registers the background location task before iOS delivers updates
import '../src/reminders'; // plans daily intake reminders and handles their buttons
import '../src/live'; // the Lock Screen and Dynamic Island view of a live session
import { screenOptions, sheet } from '../src/nav';
import { prepareAudio } from '../src/sound';
import { useStore } from '../src/store';
import { colors } from '../src/theme';

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, primary: colors.cyan, background: colors.black, card: colors.black, text: colors.text, border: 'transparent' },
};

// react-native-svg's browser build passes native-only props to the DOM; harmless, preview only.
// Errors still reach the console; the overlay only hides the bottom of the screen in the preview.
if (Platform.OS === 'web') LogBox.ignoreAllLogs();

function Gate() {
  const onboarded = useStore((s) => s.profile.onboarded);
  const segments = useSegments();
  const router = useRouter();
  useEffect(() => {
    if (!onboarded && segments[0] !== 'onboarding') router.replace('/onboarding');
  }, [onboarded, segments]);
  return null;
}

export default function RootLayout() {
  const ready = useStore((s) => s.ready);
  useEffect(() => {
    useStore.getState().hydrate();
    prepareAudio();
    // The browser preview has no San Francisco on Windows; Inter is the closest open face.
    if (Platform.OS === 'web' && !document.getElementById('inter-font')) {
      const link = document.createElement('link');
      link.id = 'inter-font';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap';
      document.head.appendChild(link);
    }
  }, []);
  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.black }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.black }}>
      <ThemeProvider value={theme}>
        <StatusBar style="light" />
        <Stack screenOptions={screenOptions}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }} />
          <Stack.Screen name="workout" options={{ presentation: 'fullScreenModal', headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="exercise/[id]" options={{ title: '' }} />
          <Stack.Screen name="library" options={{ title: 'Exercises', headerLargeTitle: true, headerSearchBarOptions: undefined }} />
          <Stack.Screen name="swap" options={{ ...sheet, sheetAllowedDetents: [0.6, 1] }} />
          <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal', headerShown: false, animation: 'fade' }} />
          <Stack.Screen name="food/[id]" options={{ ...sheet, sheetAllowedDetents: [0.92] }} />
          <Stack.Screen name="food-search" options={{ ...sheet, sheetAllowedDetents: [0.92] }} />
          <Stack.Screen name="program" options={{ title: 'Program', headerLargeTitle: true }} />
          <Stack.Screen name="templates" options={{ ...sheet, sheetAllowedDetents: [0.75, 1] }} />
          <Stack.Screen name="prescription" options={{ ...sheet, sheetAllowedDetents: [0.7] }} />
          <Stack.Screen name="cardio" options={{ title: 'Cardio', headerLargeTitle: true }} />
          <Stack.Screen name="cardio-run" options={{ presentation: 'fullScreenModal', headerShown: false, gestureEnabled: false }} />
          <Stack.Screen name="import" options={{ ...sheet, sheetAllowedDetents: [0.85] }} />
          <Stack.Screen name="session/[id]" options={{ title: '' }} />
          <Stack.Screen name="finish" options={{ presentation: 'fullScreenModal', headerShown: false, gestureEnabled: false, animation: 'fade' }} />
          <Stack.Screen name="body-entry" options={{ ...sheet, sheetAllowedDetents: [0.8] }} />
          <Stack.Screen name="check-in" options={{ ...sheet, sheetAllowedDetents: [0.55] }} />
          <Stack.Screen name="targets" options={{ ...sheet, sheetAllowedDetents: [0.7] }} />
          <Stack.Screen name="timer-settings" options={{ ...sheet, sheetAllowedDetents: [0.6] }} />
          <Stack.Screen name="intake" options={{ ...sheet, sheetAllowedDetents: [0.92] }} />
          <Stack.Screen name="day/[date]" options={{ title: '' }} />
          <Stack.Screen name="export" options={{ presentation: 'modal', headerShown: false }} />
        </Stack>
        <Gate />
        <RestEngine />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

import { Platform } from 'react-native';

import { colors } from './theme';

// iOS 26 draws glass bars itself; older versions get a blur.
const legacyBars = Platform.OS === 'ios' && Number.parseInt(String(Platform.Version), 10) < 26;

export const sheet = {
  presentation: 'formSheet',
  headerShown: false,
  sheetGrabberVisible: true,
  sheetCornerRadius: 32,
  contentStyle: { backgroundColor: colors.surface },
} as const;

export const screenOptions = {
  headerTransparent: Platform.OS === 'ios',
  headerBlurEffect: legacyBars ? ('systemChromeMaterialDark' as const) : undefined,
  headerShadowVisible: false,
  headerTintColor: colors.cyan,
  headerBackButtonDisplayMode: 'minimal' as const,
  headerTitleStyle: { color: colors.text, fontWeight: '600' as const },
  headerLargeTitleStyle: { color: colors.text },
  contentStyle: { backgroundColor: colors.black },
};


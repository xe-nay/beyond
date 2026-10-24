import { Tabs } from 'expo-router/tabs';

import { LiquidTabBar } from '../../src/components/LiquidTabBar';
import { colors } from '../../src/theme';

// Tabs are peers: no transition between them, only the glass bar's travelling dot.
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <LiquidTabBar {...props} />}
      screenOptions={{ headerShown: false, animation: 'none', sceneStyle: { backgroundColor: colors.black } }}>
      <Tabs.Screen name="today" />
      <Tabs.Screen name="train" />
      <Tabs.Screen name="food" />
      <Tabs.Screen name="progress" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

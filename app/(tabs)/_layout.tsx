import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { colors } from '../../src/theme';

// The platform's own tab bar: Liquid Glass on iOS 26, no custom transitions between peers.
export default function TabsLayout() {
  return (
    <NativeTabs tintColor={colors.cyan} minimizeBehavior="onScrollDown" labelStyle={{ color: colors.dim }}>
      <NativeTabs.Trigger name="today">
        <NativeTabs.Trigger.Icon sf="sun.max.fill" md="wb_sunny" />
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="train">
        <NativeTabs.Trigger.Icon sf="dumbbell.fill" md="fitness_center" />
        <NativeTabs.Trigger.Label>Train</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="food">
        <NativeTabs.Trigger.Icon sf="fork.knife" md="restaurant" />
        <NativeTabs.Trigger.Label>Food</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="progress">
        <NativeTabs.Trigger.Icon sf="chart.xyaxis.line" md="show_chart" />
        <NativeTabs.Trigger.Label>Progress</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Icon sf="person.crop.circle" md="account_circle" />
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

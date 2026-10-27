/// <reference types="jest" />
// Phone-only modules, replaced by recordable fakes so the app's logic can run in Node.
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationCategoryAsync: jest.fn(() => Promise.resolve()),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve([])),
  getPresentedNotificationsAsync: jest.fn(() => Promise.resolve([])),
  cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
  dismissNotificationAsync: jest.fn(() => Promise.resolve()),
  scheduleNotificationAsync: jest.fn(() => Promise.resolve('id')),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
  SchedulableTriggerInputTypes: { DATE: 'date', TIME_INTERVAL: 'timeInterval' },
}));
jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => ({ play: jest.fn(), pause: jest.fn(), seekTo: jest.fn(() => Promise.resolve()), addListener: jest.fn(() => ({ remove: jest.fn() })), volume: 1, loop: false })),
  setAudioModeAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock('expo-speech', () => ({ speak: jest.fn(), stop: jest.fn(), getAvailableVoicesAsync: jest.fn(() => Promise.resolve([])), VoiceQuality: { Enhanced: 'Enhanced', Default: 'Default' } }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(() => Promise.resolve()), impactAsync: jest.fn(() => Promise.resolve()), notificationAsync: jest.fn(() => Promise.resolve()), ImpactFeedbackStyle: {}, NotificationFeedbackType: {} }));
jest.mock('../modules/live-activity', () => ({
  liveAvailable: jest.fn(() => true), startLive: jest.fn(() => Promise.resolve('a')), updateLive: jest.fn(() => Promise.resolve()), endLive: jest.fn(() => Promise.resolve()),
  liveLog: jest.fn(), liveStatus: jest.fn(() => 'Ready'),
  startIntake: jest.fn(() => Promise.resolve('i')), endIntake: jest.fn(() => Promise.resolve()), intakeSlot: jest.fn(() => null),
  takeIntakeAnswers: jest.fn(() => []), onIntakeAnswer: jest.fn(() => null),
}));
// Animation libraries: their own official mocks.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => ({ ...require('react-native-reanimated/mock'), cubicBezier: () => 'ease' }));

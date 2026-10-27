// App-level tests: the store, screens and flows, run in Node with the phone-only modules mocked.
// (The pure domain tests run with node --test, see package.json.)
module.exports = {
  preset: 'jest-expo/ios',
  testMatch: ['<rootDir>/__tests__/**/*.test.ts?(x)'],
  setupFiles: ['<rootDir>/__tests__/setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|react-native-body-highlighter|@bacons/.*|standard-navigation|expo-router))',
  ],
};

// Expo's lint rules (React, hooks, imports) over the app's own code.
const { defineConfig } = require('eslint/config');
const expo = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expo,
  { ignores: ['dist/*', 'ios/*', 'android/*', 'targets/*', 'modules/*/ios/*', 'scripts/*', 'node_modules/*'] },
]);

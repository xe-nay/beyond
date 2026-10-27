// Expo's default Babel setup, spelled out so Jest uses it too (the app build uses the same one).
module.exports = function (api) {
  api.cache(true);
  return { presets: ['babel-preset-expo'] };
};

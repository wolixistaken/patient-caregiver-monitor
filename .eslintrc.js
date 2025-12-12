module.exports = {
  root: true,
  extends: '@react-native',
  parserOptions: {
    requireConfigFile: false, // Hatayı çözen satır burası
    babelOptions: {
      presets: ['@react-native/babel-preset'],
    },
  },
};
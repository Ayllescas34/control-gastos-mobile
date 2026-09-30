module.exports = {
  preset: '@react-native/jest-preset',
  // Preset pattern + @react-navigation, which ships ES modules (per React Navigation testing docs).
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation)/)',
  ],
};

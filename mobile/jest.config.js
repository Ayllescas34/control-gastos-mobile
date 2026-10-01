module.exports = {
  preset: '@react-native/jest-preset',
  // Preset pattern + @react-navigation, which ships ES modules (per React Navigation testing docs).
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@react-navigation)/)',
  ],
  moduleNameMapper: {
    // Jest's "react-native" export condition picks Lucide's ESM (.mjs) icon files, which
    // Jest does not transform. Use the package's own CommonJS build of the same icons.
    '^lucide-react-native/icons/(.*)$':
      '<rootDir>/node_modules/lucide-react-native/dist/cjs/icons/$1.js',
  },
};

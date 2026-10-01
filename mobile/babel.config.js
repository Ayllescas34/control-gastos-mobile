module.exports = {
  presets: ['module:@react-native/babel-preset'],
  // Inlines .sql files as strings (Drizzle migrations). Applies to Metro and Jest.
  plugins: [['inline-import', { extensions: ['.sql'] }]],
};

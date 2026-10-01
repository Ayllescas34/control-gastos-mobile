module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // Icons go through the app's own system (<Icon name="..." />), see docs/ui-icons.md.
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['lucide-react-native', 'lucide-react-native/*'],
            message:
              'Use Icon/IconBadge/IconButton from src/shared/icons instead of importing Lucide directly.',
          },
        ],
      },
    ],
  },
  overrides: [
    {
      // The icon registry is the single place allowed to import Lucide glyphs.
      files: ['src/shared/icons/**'],
      rules: { 'no-restricted-imports': 'off' },
    },
  ],
};

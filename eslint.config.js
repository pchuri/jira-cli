const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  {
    ignores: ['coverage/', 'node_modules/']
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
        ...globals.jest
      }
    },
    rules: {
      indent: ['error', 2],
      'linebreak-style': ['error', 'unix'],
      quotes: ['error', 'single'],
      semi: ['error', 'always'],
      'no-console': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  }
];

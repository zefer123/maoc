import js from '@eslint/js';
import hooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  { ignores: ['**/dist/**', '**/node_modules/**', '**/vault/**', '**/docs/**', '**/coverage/**'] },
  {
    files: ['src/**/*.{js,jsx}', 'server/src/**/*.js'],
    rules: {
      'no-undef': js.configs.recommended.rules['no-undef'],
      'no-unreachable': js.configs.recommended.rules['no-unreachable'],
      'no-constant-condition': js.configs.recommended.rules['no-constant-condition'],
      'no-unused-vars': ['warn', { varsIgnorePattern: '^_', argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: { globals: globals.browser, parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { 'react-hooks': hooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: ['server/src/**/*.js'],
    languageOptions: { globals: globals.nodeBuiltin },
  },
  {
    // The standalone prototype loads these as classic scripts, in this order.
    files: ['src/components/cc/realm-prototype.js', 'src/components/cc/realm-opening-prototype.js', 'src/components/cc/realm-navigation-prototype.js'],
    languageOptions: { sourceType: 'script' },
  },
  {
    files: ['src/components/cc/realm-opening-prototype.js'],
    languageOptions: { globals: { requestDraw: 'readonly', selectRealmScene: 'readonly' } },
  },
];
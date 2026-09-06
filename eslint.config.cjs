const {defineConfig} = require('eslint/config');
const expo = require('eslint-config-expo/flat');
module.exports = defineConfig([
  expo,
  {ignores: ['node_modules/**', 'dist/**', 'coverage/**', '.expo/**', 'android/**', 'ios/**']},
  {files: ['**/*.test.ts', '**/*.screen.test.tsx', 'test/**/*.ts'], languageOptions: {globals: {jest: 'readonly', describe: 'readonly', it: 'readonly', test: 'readonly', expect: 'readonly', beforeEach: 'readonly', afterEach: 'readonly'}}},
]);

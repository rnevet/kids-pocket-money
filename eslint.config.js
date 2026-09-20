import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'node_modules'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': 'off',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/google/*', '**/data/*', 'react', 'react-dom'],
              message: 'domain/ must stay pure',
            },
          ],
        },
      ],
    },
  },
  {
    // The layering rule above only applies to domain/. Relax it elsewhere.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/domain/**'],
    rules: { '@typescript-eslint/no-restricted-imports': 'off' },
  },
  {
    files: ['src/ui/**/*.{ts,tsx}'],
    rules: {
      // Runtime imports of the Google layer are for state/ and data/. Types are fine.
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/google/*'],
              allowTypeImports: true,
              message: 'ui/ goes through state/ and data/',
            },
          ],
        },
      ],
      'react-refresh/only-export-components': 'off',
    },
  },
);

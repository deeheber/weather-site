import js from '@eslint/js'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import globals from 'globals'

export default [
  {
    files: ['**/*.ts'],
    ignores: [
      '**/*.js',
      '**/*.d.ts',
      '**/node_modules/',
      'cdk.out/**/*',
      'dist/**/*',
    ],
    plugins: {
      'simple-import-sort': simpleImportSort,
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tseslint.configs.recommended.rules,
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'no-array-constructor': 'error',
      'no-unused-vars': 'error',
      'no-unused-expressions': 'error',
      'no-console': 'warn',
    },
    languageOptions: {
      globals: {
        ...globals.jest,
        ...globals.node,
      },
      parser: tsParser,
    },
  },
]

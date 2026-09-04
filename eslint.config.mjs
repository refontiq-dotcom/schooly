import next from 'eslint-config-next';

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...next,
  {
    ignores: [
      'node_modules',
      '.next',
      'coverage',
      'playwright-report',
      'test-results',
      'supabase/functions',
      'e2e',
    ],
  },
];

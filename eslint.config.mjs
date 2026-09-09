import next from 'eslint-config-next';

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...next,
  {
    ignores: [
      'node_modules',
      '**/.next',
      '**/next-env.d.ts',
      'coverage',
      'playwright-report',
      'test-results',
      'packages/db/supabase',
    ],
  },
];

import next from 'eslint-config-next';

/** @type {import('eslint').Linter.Config[]} */
const eslintConfig = [
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
      // Worktrees d'IDE (Kilo) : copies d'un autre checkout — ne jamais les
      // qualifier (sinon chaque erreur est comptée deux fois, dont une fois
      // sur un snapshot périmé).
      '.kilo',
    ],
  },
];

export default eslintConfig;

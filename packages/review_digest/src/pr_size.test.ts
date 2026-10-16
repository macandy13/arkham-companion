import { describe, expect, it } from 'vitest';
import { measurePr, parseNumstat, sizeCategory } from './pr_size.ts';

describe('sizeCategory', () => {
  it.each([
    ['packages/engine/src/doom.ts', 'production'],
    ['apps/web/src/App.tsx', 'production'],
    ['.github/workflows/ci.yml', 'production'],
    ['packages/engine/src/doom.test.ts', 'test'],
    ['apps/web/src/App.test.tsx', 'test'],
    ['apps/web/e2e/new_game.spec.ts', 'test'],
    ['packages/engine/test/utils/index.ts', 'test'],
    ['docs/architecture.md', 'docs'],
    ['docs/tasks/M1-engine.md', 'excluded'],
    ['pnpm-lock.yaml', 'excluded'],
    ['CHANGELOG.md', 'excluded'],
    ['packages/engine/api.md', 'excluded'],
  ])('%s → %s', (file, expected) => {
    expect(sizeCategory(file)).toBe(expected);
  });
});

describe('parseNumstat', () => {
  it('reads added and deleted lines per file and skips binary files', () => {
    const numstat = [
      '12\t3\tpackages/engine/src/doom.ts',
      '-\t-\tapps/web/public/icon.png',
      '',
    ].join('\n');

    expect(parseNumstat(numstat)).toEqual([
      { file: 'packages/engine/src/doom.ts', added: 12, deleted: 3 },
    ]);
  });
});

describe('measurePr', () => {
  it('sums added plus deleted lines per category and leaves excluded lines out of the total', () => {
    const size = measurePr([
      { file: 'packages/engine/src/doom.ts', added: 100, deleted: 20 },
      { file: 'packages/engine/src/doom.test.ts', added: 200, deleted: 0 },
      { file: 'docs/architecture.md', added: 5, deleted: 5 },
      { file: 'pnpm-lock.yaml', added: 900, deleted: 100 },
    ]);

    expect(size).toEqual({ production: 120, test: 200, docs: 10, excluded: 1000, total: 330 });
  });
});

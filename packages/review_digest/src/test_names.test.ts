import { describe, expect, it } from 'vitest';
import { diffTestNames } from './test_names.ts';

describe('diffTestNames', () => {
  const roots = { base: '/base', head: '/head' };
  const doomTests = 'packages/engine/src/doom.test.ts';

  it('lists added and removed test names per file, ignoring the checkout root', () => {
    const base = [
      { name: 'doom > counts doom on the agenda', file: `/base/${doomTests}` },
      { name: 'doom > counts doom on cards', file: `/base/${doomTests}` },
    ];
    const head = [
      { name: 'doom > counts doom on the agenda', file: `/head/${doomTests}` },
      { name: 'doom > counts doom on player cards', file: `/head/${doomTests}` },
    ];

    const changes = diffTestNames(base, head, roots);

    expect(changes).toEqual([
      {
        file: doomTests,
        added: ['doom > counts doom on player cards'],
        removed: ['doom > counts doom on cards'],
      },
    ]);
  });

  it('shows a new test file with all its tests added, sorted by path', () => {
    const actTests = 'packages/engine/src/act.test.ts';
    const head = [
      { name: 'doom > counts doom on the agenda', file: `/head/${doomTests}` },
      { name: 'act > advances with clues', file: `/head/${actTests}` },
    ];

    const changes = diffTestNames([], head, roots);

    expect(changes).toEqual([
      { file: actTests, added: ['act > advances with clues'], removed: [] },
      { file: doomTests, added: ['doom > counts doom on the agenda'], removed: [] },
    ]);
  });

  it('leaves out files whose test names did not change', () => {
    const base = [{ name: 'doom > counts doom on the agenda', file: `/base/${doomTests}` }];
    const head = [{ name: 'doom > counts doom on the agenda', file: `/head/${doomTests}` }];

    const changes = diffTestNames(base, head, roots);

    expect(changes).toEqual([]);
  });
});

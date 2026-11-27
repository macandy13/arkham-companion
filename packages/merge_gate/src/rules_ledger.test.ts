import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  linkTestRefs,
  missingTests,
  parseTestRefs,
  repoFileReader,
  rulesPages,
  unlinkedTestRefs,
} from './rules_ledger.ts';

describe('parseTestRefs', () => {
  it('reads a test file and its titles from a code span, and ignores other spans', () => {
    const page = [
      '- A hunter heads for the nearest investigator.',
      '  Test: `packages/engine/src/hunters.test.ts › MoveHunters › heads for the nearest investigator`',
      '- Prey picks the target (`prey.md`, `Prey – Bob only`).',
    ].join('\n');

    expect(parseTestRefs(page)).toEqual([
      {
        file: 'packages/engine/src/hunters.test.ts',
        titles: ['MoveHunters', 'heads for the nearest investigator'],
      },
    ]);
  });

  it('reads a code span that is the text of a link', () => {
    const page =
      '  Test: [`packages/engine/src/hunters.test.ts › MoveHunters › heads for the nearest investigator`](../../packages/engine/src/hunters.test.ts#L3)';

    expect(parseTestRefs(page)).toEqual([
      {
        file: 'packages/engine/src/hunters.test.ts',
        titles: ['MoveHunters', 'heads for the nearest investigator'],
      },
    ]);
  });
});

describe('linkTestRefs', () => {
  const hunterTests = [
    "describe('MoveHunters', () => {",
    "  it('moves one step', () => {});",
    "  it('heads for the nearest investigator', () => {});",
  ].join('\n');
  const read = (file: string): string | undefined =>
    file === 'packages/engine/src/hunters.test.ts' ? hunterTests : undefined;
  const span =
    '`packages/engine/src/hunters.test.ts › MoveHunters › heads for the nearest investigator`';
  const linked = `[${span}](../../packages/engine/src/hunters.test.ts#L3)`;

  it.each([
    { name: 'a bare span', before: `Test: ${span}`, after: `Test: ${linked}` },
    {
      name: 'a link to a line the test moved from',
      before: `Test: [${span}](../../packages/engine/src/hunters.test.ts#L9)`,
      after: `Test: ${linked}`,
    },
    { name: 'an up-to-date link', before: `Test: ${linked}`, after: `Test: ${linked}` },
  ])('links $name on docs/rules/hunter.md to the test line', ({ before, after }) => {
    expect(linkTestRefs('docs/rules/hunter.md', before, read)).toBe(after);
  });

  it.each([
    {
      name: 'a missing test',
      markdown: 'Test: `packages/engine/src/hunters.test.ts › MoveHunters › patrols`',
    },
    { name: 'a span that names no test', markdown: 'see `prey.md`' },
  ])('leaves $name as it is', ({ markdown }) => {
    expect(linkTestRefs('docs/rules/hunter.md', markdown, read)).toBe(markdown);
  });

  it('climbs one more directory for a page in docs/rules/cards/', () => {
    expect(linkTestRefs('docs/rules/cards/objectives.md', `Test: ${span}`, read)).toBe(
      `Test: [${span}](../../../packages/engine/src/hunters.test.ts#L3)`,
    );
  });
});

describe('unlinkedTestRefs', () => {
  const span =
    '`packages/engine/src/hunters.test.ts › MoveHunters › heads for the nearest investigator`';

  it.each([
    {
      name: 'a link to the test file, at any line',
      line: `[${span}](../../packages/engine/src/hunters.test.ts#L9)`,
      unlinked: false,
    },
    { name: 'a bare span', line: span, unlinked: true },
    {
      name: 'a link to another file',
      line: `[${span}](../../packages/engine/src/prey.test.ts#L3)`,
      unlinked: true,
    },
  ])('counts $name on docs/rules/hunter.md as unlinked: $unlinked', ({ line, unlinked }) => {
    expect(unlinkedTestRefs('docs/rules/hunter.md', `Test: ${line}`)).toHaveLength(
      unlinked ? 1 : 0,
    );
  });
});

describe('missingTests', () => {
  const hunterTests = [
    "const moveHunters = { type: 'MoveHunters' };",
    "describe('MoveHunters', () => {",
    "  it('heads for the nearest investigator', () => {",
    '  it.each([{ count: steps(1) }])(`moves $count steps`, () => {',
    '});',
    "describe('MoveHunters order', () => {",
    "  it('asks the lead investigator for the order', () => {",
  ].join('\n');
  const read = (file: string): string | undefined =>
    file === 'hunters.test.ts' ? hunterTests : undefined;

  it.each([
    {
      name: 'an existing test',
      titles: ['MoveHunters', 'heads for the nearest investigator'],
      missing: false,
    },
    {
      name: 'a table test by its template title',
      titles: ['MoveHunters', 'moves $count steps'],
      missing: false,
    },
    {
      name: 'a renamed test',
      titles: ['MoveHunters', 'heads for the closest investigator'],
      missing: true,
    },
    {
      name: 'a renamed describe',
      titles: ['Hunters', 'heads for the nearest investigator'],
      missing: true,
    },
    {
      name: 'a test named under a describe that comes after it',
      titles: ['MoveHunters order', 'heads for the nearest investigator'],
      missing: true,
    },
  ])('$name is missing: $missing', ({ titles, missing }) => {
    const ref = { file: 'hunters.test.ts', titles };

    expect(missingTests([ref], read)).toEqual(missing ? [ref] : []);
  });

  it('does not take a command literal or an assertion for a describe title', () => {
    const renamed = [
      "const moveHunters = { type: 'MoveHunters' };",
      "describe('Hunter movement', () => {",
      "  expect(moveHunters.type).toBe('MoveHunters');",
      "  it('heads for the nearest investigator', () => {",
    ].join('\n');
    const ref = {
      file: 'renamed.test.ts',
      titles: ['MoveHunters', 'heads for the nearest investigator'],
    };

    expect(missingTests([ref], () => renamed)).toEqual([ref]);
  });

  it('counts a test in a deleted file as missing', () => {
    const ref = { file: 'gone.test.ts', titles: ['anything'] };

    expect(missingTests([ref], read)).toEqual([ref]);
  });
});

describe('the rules pages in docs/rules/', () => {
  const root = join(import.meta.dirname, '../../..');
  const pages = rulesPages(root);
  const readTestFile = repoFileReader(root);

  it('name only tests that exist', () => {
    const missing = pages.flatMap((page) =>
      missingTests(parseTestRefs(readFileSync(join(root, page), 'utf8')), readTestFile).map(
        (ref) => `${page}: ${[ref.file, ...ref.titles].join(' › ')}`,
      ),
    );

    expect(missing).toEqual([]);
  });

  it('link each test to its file (run `pnpm rules:links` to add the links)', () => {
    const unlinked = pages.flatMap((page) =>
      unlinkedTestRefs(page, readFileSync(join(root, page), 'utf8')).map(
        (span) => `${page}: ${span}`,
      ),
    );

    expect(unlinked).toEqual([]);
  });
});

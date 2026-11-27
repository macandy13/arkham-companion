import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { missingTests, parseTestRefs } from './rules_ledger.ts';

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
});

describe('missingTests', () => {
  const hunterTests = [
    "describe('MoveHunters', () => {",
    "  it('heads for the nearest investigator', () => {",
    '  it.each([])(`moves $count steps`, () => {',
  ].join('\n');
  const files: Record<string, string> = { 'hunters.test.ts': hunterTests };
  const read = (file: string): string | undefined => files[file];

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
  ])('$name is missing: $missing', ({ titles, missing }) => {
    const ref = { file: 'hunters.test.ts', titles };

    expect(missingTests([ref], read)).toEqual(missing ? [ref] : []);
  });

  it('counts a test in a deleted file as missing', () => {
    const ref = { file: 'gone.test.ts', titles: ['anything'] };

    expect(missingTests([ref], read)).toEqual([ref]);
  });
});

describe('the rules pages in docs/rules/', () => {
  const root = join(import.meta.dirname, '../../..');
  const pages = readdirSync(join(root, 'docs/rules'), { recursive: true, encoding: 'utf8' })
    .filter((path) => path.endsWith('.md'))
    .map((path) => join(root, 'docs/rules', path));

  it('name only tests that exist', () => {
    const missing = pages.flatMap((page) =>
      missingTests(parseTestRefs(readFileSync(page, 'utf8')), (file) => {
        const path = join(root, file);
        return existsSync(path) ? readFileSync(path, 'utf8') : undefined;
      }).map((ref) => `${relative(root, page)}: ${[ref.file, ...ref.titles].join(' › ')}`),
    );

    expect(missing).toEqual([]);
  });
});

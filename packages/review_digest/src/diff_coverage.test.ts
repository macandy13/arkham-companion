import { describe, expect, it } from 'vitest';
import { isRulesCode, uncoveredChangedLines, type FileCoverage } from './diff_coverage.ts';

/** Coverage for a file whose statements start on the given lines with the given hit counts. */
function coverageOf(hitsByLine: Record<number, number>): FileCoverage {
  const lines = Object.entries(hitsByLine);
  return {
    statementMap: Object.fromEntries(
      lines.map(([line], id) => [String(id), { start: { line: Number(line) } }]),
    ),
    s: Object.fromEntries(lines.map(([, hits], id) => [String(id), hits])),
  };
}

describe('isRulesCode', () => {
  it.each([
    ['packages/engine/src/doom.ts', true],
    ['packages/scenarios/src/the_gathering/scenario.ts', true],
    ['packages/engine/src/doom.test.ts', false],
    ['packages/engine/test/utils/index.ts', false],
    ['apps/web/src/App.tsx', false],
    ['packages/carddata/src/schema.ts', false],
  ])('%s → %s', (file, expected) => {
    expect(isRulesCode(file)).toBe(expected);
  });
});

describe('uncoveredChangedLines', () => {
  const root = '/repo';
  const doom = 'packages/engine/src/doom.ts';

  it('reports changed statement lines that never ran', () => {
    const coverage = { [`${root}/${doom}`]: coverageOf({ 10: 3, 20: 0, 30: 0 }) };

    const uncovered = uncoveredChangedLines(coverage, new Map([[doom, [10, 20]]]), root);

    expect(uncovered).toEqual([{ file: doom, ranges: [{ from: 20, to: 20 }] }]);
  });

  it('merges uncovered lines with no other statement between them into one range', () => {
    const coverage = { [`${root}/${doom}`]: coverageOf({ 10: 0, 11: 0, 14: 0, 20: 0 }) };

    const uncovered = uncoveredChangedLines(
      coverage,
      new Map([[doom, [10, 11, 12, 14, 30]]]),
      root,
    );

    expect(uncovered).toEqual([{ file: doom, ranges: [{ from: 10, to: 14 }] }]);
  });

  it('splits ranges at an unchanged statement in between', () => {
    const coverage = { [`${root}/${doom}`]: coverageOf({ 10: 0, 15: 0, 20: 0 }) };

    const uncovered = uncoveredChangedLines(coverage, new Map([[doom, [10, 20]]]), root);

    expect(uncovered).toEqual([
      {
        file: doom,
        ranges: [
          { from: 10, to: 10 },
          { from: 20, to: 20 },
        ],
      },
    ]);
  });

  it('counts a line as covered when any statement on it ran', () => {
    const coverage = {
      [`${root}/${doom}`]: {
        statementMap: { first: { start: { line: 10 } }, second: { start: { line: 10 } } },
        s: { first: 0, second: 1 },
      },
    };

    const uncovered = uncoveredChangedLines(coverage, new Map([[doom, [10]]]), root);

    expect(uncovered).toEqual([]);
  });

  it('ignores changed files outside rules code and files without coverage', () => {
    const app = 'apps/web/src/App.tsx';
    const coverage = { [`${root}/${app}`]: coverageOf({ 1: 0 }) };

    const uncovered = uncoveredChangedLines(
      coverage,
      new Map([
        [app, [1]],
        [doom, [1]],
      ]),
      root,
    );

    expect(uncovered).toEqual([]);
  });
});

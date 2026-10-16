import { describe, expect, it } from 'vitest';
import { renderDigest, type Digest } from './render.ts';

const blobUrl = 'https://github.com/macandy13/arkham-companion/blob/abc123';
const smallPr = { production: 120, test: 200, docs: 10, excluded: 1000, total: 330 };

describe('renderDigest', () => {
  it.each([
    ['within budget', smallPr, 'within budget.'],
    ['over the production budget', { ...smallPr, production: 401, total: 611 }, '**over budget**'],
    ['over the total budget', { ...smallPr, test: 900, total: 1030 }, '**over budget**'],
  ])('reports a PR %s', (_, size, expected) => {
    const markdown = renderDigest({ size, uncovered: [], tests: [], blobUrl });

    expect(markdown).toContain(expected);
  });

  it('links each untested range to the lines at the PR head', () => {
    const digest: Digest = {
      size: smallPr,
      uncovered: [
        {
          file: 'packages/engine/src/doom.ts',
          ranges: [
            { from: 20, to: 20 },
            { from: 30, to: 34 },
          ],
        },
      ],
      tests: [],
      blobUrl,
    };

    const markdown = renderDigest(digest);

    expect(markdown).toContain(
      `- \`packages/engine/src/doom.ts\` [20](${blobUrl}/packages/engine/src/doom.ts#L20), ` +
        `[30–34](${blobUrl}/packages/engine/src/doom.ts#L30-L34)`,
    );
  });

  it.each([
    [[], 'none, every changed engine and scenario line runs in a test.'],
    [undefined, 'not available, the coverage run failed.'],
  ])('says when there is no untested line to list (%j)', (uncovered, expected) => {
    const markdown = renderDigest({ size: smallPr, uncovered, tests: [], blobUrl });

    expect(markdown).toContain(`**Untested changed lines:** ${expected}`);
  });

  it('lists added and removed test names in a collapsed block per file', () => {
    const digest: Digest = {
      size: smallPr,
      uncovered: [],
      tests: [
        {
          file: 'packages/engine/src/doom.test.ts',
          added: ['doom > counts doom on player cards'],
          removed: ['doom > counts doom on cards'],
        },
      ],
      blobUrl,
    };

    const markdown = renderDigest(digest);

    expect(markdown).toContain(
      [
        '<details><summary><code>packages/engine/src/doom.test.ts</code>: +1 −1</summary>',
        '',
        '- added: doom › counts doom on player cards',
        '- removed: doom › counts doom on cards',
        '',
        '</details>',
      ].join('\n'),
    );
  });

  it('says when no test names changed', () => {
    const markdown = renderDigest({ size: smallPr, uncovered: [], tests: [], blobUrl });

    expect(markdown).toContain('**What the tests claim:** no test names changed.');
  });
});

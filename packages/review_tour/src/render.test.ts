import { describe, expect, it } from 'vitest';
import {
  renderPage,
  splitTitle,
  type PageInput,
  type StopContent,
  type StopPicture,
} from './render.ts';
import type { Tour } from './tour.ts';

describe('splitTitle', () => {
  it.each([
    [
      'feat(web): draw a weakness (ME.26c)',
      { headline: 'Draw a weakness', labels: ['feat(web)', 'ME.26c'] },
    ],
    [
      'refactor(engine): one DealEnemyAttack',
      { headline: 'One DealEnemyAttack', labels: ['refactor(engine)'] },
    ],
    ['docs: rules for aloof', { headline: 'Rules for aloof', labels: ['docs'] }],
    ['Update the readme', { headline: 'Update the readme', labels: [] }],
  ])('splits %s', (title, split) => {
    expect(splitTitle(title)).toEqual(split);
  });
});

describe('renderPage', () => {
  const noContent: StopContent = { code: [], pictures: [] };

  /** A tour without evidence may leave the list out. */
  function page(
    tour: Omit<Tour, 'evidence'> & Partial<Pick<Tour, 'evidence'>>,
    stops: readonly StopContent[],
    evidence: readonly (readonly StopPicture[])[] = [],
  ): string {
    const input: PageInput = {
      pr: {
        number: 1367,
        title: 'feat(web): draw a weakness',
        url: 'https://github.com/o/r/pull/1367',
        headSha: '071f14c4205',
      },
      tour: { evidence: [], ...tour },
      stops,
      evidence,
      changedLines: { all: 482, onTour: 50 },
    };
    return renderPage(input);
  }

  it('leads with the concept, the questions and a numbered stop', () => {
    const html = page(
      {
        concept: 'Players draw a <weakness> from the card.',
        questions: [{ text: 'Share the `search` style now?', stop: 1, picked: 'later' }],
        stops: [{ title: 'The dialog', tag: 'UI', text: 'A pick draws it.', code: [] }],
        rest: [],
      },
      [noContent],
    );

    expect(html).toContain('<h1>Draw a weakness</h1>');
    expect(html).toContain('<p class="kicker">feat(web) · as of 071f14c</p>');
    expect(html).toContain('Players draw a &lt;weakness&gt; from the card.');
    expect(html).toContain('<p>Share the <code>search</code> style now?</p>');
    expect(html).toContain('Concerns <a href="#stop-1">stop 1</a>. Picked: later.');
    expect(html).toContain(
      '<span class="stop-number">1</span><span class="tag">UI</span><h2>The dialog</h2>',
    );
    expect(html).toContain('<span>50 of 482 changed lines on the tour</span>');
  });

  it('states the problem before what changes', () => {
    const html = page(
      {
        problem: 'Players had to find the weakness by hand.',
        concept: 'The card draws it for them.',
        questions: [],
        stops: [],
        rest: [],
      },
      [],
    );

    expect(html).toMatch(
      /<h2>The problem<\/h2><p>Players had to find the weakness by hand.<\/p>[\s\S]*<h2>What changes<\/h2><p>The card draws it for them.<\/p>/,
    );
  });

  it('shows each claim with its test, its example and its golden', () => {
    const golden: StopPicture = {
      device: 'desktop',
      changed: true,
      after: 'https://raw/after.png',
    };
    const html = page(
      {
        concept: 'Attacks share one command.',
        questions: [],
        stops: [],
        evidence: [
          {
            claim: 'An attack of opportunity leaves the enemy ready.',
            test: 'attacks.test.ts › leaves the enemy ready',
          },
          {
            claim: 'A cancelled attack deals nothing.',
            example: 'deal({ cancelled: true }) // → []',
          },
          { claim: 'The dialog shows the attack.', picture: 'shots/attack.png' },
        ],
        rest: [],
      },
      [],
      [[], [], [golden]],
    );

    expect(html).toContain('<h2>How we know it works</h2>');
    expect(html).toContain(
      '<p>An attack of opportunity leaves the enemy ready.</p><p class="test">Checked by <code>attacks.test.ts › leaves the enemy ready</code></p>',
    );
    expect(html).toMatch(/<pre class="example"><code>.*deal.*cancelled.*<\/code><\/pre>/);
    expect(html).toContain('https://raw/after.png');
    expect(html).toContain('href="#evidence"');
  });

  it('shows the usage before the change above the usage now', () => {
    const html = page(
      {
        concept: 'Attacks share one command.',
        questions: [],
        stops: [],
        evidence: [
          {
            claim: 'An attack names its kind.',
            example: "deal({ kind: 'cardAttack' })",
            before: 'resolveEnemyAttack()',
          },
        ],
        rest: [],
      },
      [],
      [[]],
    );

    expect(html).toMatch(
      /<p class="when">Before<\/p><pre class="example"><code>.*resolveEnemyAttack.*<\/code><\/pre><p class="when">Now<\/p><pre class="example"><code>.*cardAttack/,
    );
  });

  it('leaves out the problem when the tour has none', () => {
    const html = page({ concept: 'A rename.', questions: [], stops: [], rest: [] }, []);

    expect(html).not.toContain('The problem');
    expect(html).toContain('<h2>What changes</h2><p>A rename.</p>');
  });

  it('leaves out the questions and the rest when the tour has none', () => {
    const html = page({ concept: 'A rename.', questions: [], stops: [], rest: [] }, []);

    expect(html).not.toContain('id="questions"');
    expect(html).not.toContain('Not on the tour');
    expect(html).not.toContain('How we know it works');
  });

  it('marks added and removed lines, but not every line of a new file', () => {
    const tour: Tour = {
      concept: 'C.',
      questions: [],
      evidence: [],
      stops: [{ title: 'Code', text: 'T.', code: [] }],
      rest: [],
    };
    const changed: StopContent = {
      pictures: [],
      code: [
        {
          file: 'src/catalog.ts',
          newFile: false,
          added: 1,
          removed: 1,
          diffUrl: 'https://github.com/o/r/pull/1367/files#diff-abcR2-R2',
          lines: [
            { kind: 'removed', number: 2, text: 'old();', highlighted: false },
            { kind: 'added', number: 2, text: 'next();', highlighted: false },
          ],
        },
        {
          file: 'src/groups.ts',
          newFile: true,
          added: 9,
          removed: 0,
          diffUrl: 'https://github.com/o/r/pull/1367/files#diff-defR1-R1',
          lines: [{ kind: 'added', number: 1, text: 'groups();', highlighted: false }],
        },
      ],
    };

    const html = page(tour, [changed]);

    expect(html).toContain(
      '<span class="line removed"><span class="number">2</span><span class="mark">−</span>',
    );
    expect(html).toContain(
      '<span class="line added"><span class="number">2</span><span class="mark">+</span>',
    );
    expect(html).toContain(
      '<span class="line context"><span class="number">1</span><span class="mark"> </span>',
    );
    expect(html).toContain('<span>+1 −1</span>');
    expect(html).toContain('<span>new file</span>');
  });

  it.each([
    [
      'colours TypeScript',
      'src/rules.ts',
      '<span class="k">const</span> on = <span class="k">true</span>;',
    ],
    ['leaves YAML plain', '.github/workflows/ci.yml', 'const on = true;'],
  ])('%s', (_case, file, text) => {
    const tour: Tour = {
      concept: 'C.',
      questions: [],
      evidence: [],
      stops: [{ title: 'Code', text: 'T.', code: [] }],
      rest: [],
    };
    const code = {
      file,
      newFile: false,
      added: 0,
      removed: 0,
      diffUrl: 'https://github.com/o/r/pull/1367/files',
      lines: [{ kind: 'context', number: 1, text: 'const on = true;', highlighted: false }],
    } as const;

    expect(page(tour, [{ code: [code], pictures: [] }])).toContain(
      `<span class="text">${text}</span>`,
    );
  });

  it.each([
    ['offers before and after for a changed golden', true, true],
    ['shows only the picture for an unchanged one', false, false],
  ])('%s', (_case, changed, toggles) => {
    const tour: Tour = {
      concept: 'C.',
      questions: [],
      evidence: [],
      stops: [{ title: 'Card', text: 'T.', code: [] }],
      rest: [],
    };
    const picture = {
      device: 'desktop',
      changed,
      before: 'https://raw/base/card.png',
      after: 'https://raw/head/card.png',
    } as const;

    const html = page(tour, [{ code: [], pictures: [picture] }]);

    expect(html.includes('value="before"')).toBe(toggles);
    expect(html).toContain('data-variants="[{&quot;device&quot;:&quot;desktop&quot;');
  });
});

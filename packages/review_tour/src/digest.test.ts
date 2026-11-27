import { describe, expect, it } from 'vitest';
import { addedRuleClaims, mergedWithoutOwner, renderDigest, type MergedPr } from './digest.ts';

/** A merged PR at head `head_after_fix` with no reviews, no tour and no files unless given. */
const mergedPr = (overrides: Partial<MergedPr>): MergedPr => ({
  number: 1500,
  title: 'feat(engine): hunters skip barricades (ME.13b)',
  body: 'Hunters now go round a barricaded location.',
  headSha: 'head_after_fix',
  reviews: [],
  files: [],
  ...overrides,
});

describe('mergedWithoutOwner', () => {
  it.each([
    { name: 'no review', reviews: [], listed: true },
    {
      name: "the owner's approval of the head",
      reviews: [{ author: 'macandy13', state: 'APPROVED', commit: 'head_after_fix' }],
      listed: false,
    },
    {
      name: "the owner's approval of an earlier commit",
      reviews: [{ author: 'macandy13', state: 'APPROVED', commit: 'head_before_fix' }],
      listed: true,
    },
    {
      name: "someone else's approval of the head",
      reviews: [{ author: 'arkham-claude[bot]', state: 'APPROVED', commit: 'head_after_fix' }],
      listed: true,
    },
    {
      name: "the owner's approval of the head, then a request for changes",
      reviews: [
        { author: 'macandy13', state: 'APPROVED', commit: 'head_after_fix' },
        { author: 'macandy13', state: 'CHANGES_REQUESTED', commit: 'head_after_fix' },
      ],
      listed: true,
    },
    {
      name: "the owner's approval of the head, then a comment",
      reviews: [
        { author: 'macandy13', state: 'APPROVED', commit: 'head_after_fix' },
        { author: 'macandy13', state: 'COMMENTED', commit: 'head_after_fix' },
      ],
      listed: false,
    },
    {
      name: "the owner's comment on the head",
      reviews: [{ author: 'macandy13', state: 'COMMENTED', commit: 'head_after_fix' }],
      listed: true,
    },
  ])('lists a PR with $name: $listed', ({ reviews, listed }) => {
    const pr = mergedPr({ headSha: 'head_after_fix', reviews });

    expect(mergedWithoutOwner([pr], 'macandy13')).toEqual(listed ? [pr] : []);
  });
});

describe('addedRuleClaims', () => {
  it('reads the added list items of rules pages, sub-claims too, and nothing else', () => {
    const rulesPatch = [
      '@@ -4,3 +4,6 @@',
      ' - Hunter: moves one step towards the nearest investigator.',
      '+- A hunter never steps into a location a card closes to it.',
      '+  Test: [`packages/engine/src/player_cards.test.ts › Barricade › $name`](../../x.test.ts#L3)',
      '+  - That holds after the players picked whom it hunts too.',
      '-- Nearest counts connections through blocked moves.',
    ].join('\n');
    const files = [
      { filename: 'docs/rules/hunter.md', patch: rulesPatch },
      { filename: 'docs/automation.md', patch: '+- Smoke run on every PR.' },
      { filename: 'docs/rules/cards/restrictions.md' },
    ];

    expect(addedRuleClaims(files)).toEqual([
      'A hunter never steps into a location a card closes to it.',
      'That holds after the players picked whom it hunts too.',
    ]);
  });
});

describe('renderDigest', () => {
  const repo = 'macandy13/arkham-companion';

  it('shows the tour, the gate reason, the rule claims and the two links', () => {
    const tour = {
      problem: 'Hunters walked into barricaded rooms.',
      concept: 'A hunter takes another `equally short` step.',
      questions: [],
      stops: [],
      evidence: [],
      rest: [],
    };
    const pr = mergedPr({
      number: 1500,
      title: 'feat(engine): hunters skip barricades (ME.13b)',
      body: `Intro.\n\n<!-- review-tour\n${JSON.stringify(tour)}\n-->`,
      gate: { state: 'success', description: 'Reviewer and rules checker passed 1a2b3c4.' },
      files: [{ filename: 'docs/rules/hunter.md', patch: '+- A hunter avoids barricades.' }],
    });

    const page = renderDigest({ repo, date: '2026-11-27', prs: [pr] });

    expect(page).toContain('<h1>Merged without you</h1>');
    expect(page).toContain('<p class="kicker">#1500 · feat(engine) · ME.13b</p>');
    expect(page).toContain(
      '<a href="https://github.com/macandy13/arkham-companion/pull/1500">Hunters skip barricades</a>',
    );
    expect(page).toContain('<p>Hunters walked into barricaded rooms.</p>');
    expect(page).toContain('<p>A hunter takes another <code>equally short</code> step.</p>');
    expect(page).toContain('<p>Reviewer and rules checker passed 1a2b3c4.</p>');
    expect(page).toContain('<li>A hunter avoids barricades.</li>');
    expect(page).toContain(
      '<a href="https://github.com/macandy13/arkham-companion/pull/1500">Revert</a>',
    );
    expect(page).toContain(
      'issues/new?title=Follow-up+to+%231500%3A+Hunters+skip+barricades&amp;body=Follow-up+to+%231500.',
    );
  });

  it("uses the description's first paragraph for a PR without a tour", () => {
    const pr = mergedPr({
      body: 'Hunters now go round a barricaded location.\n\nThe second paragraph stays out.',
    });

    const page = renderDigest({ repo, date: '2026-11-27', prs: [pr] });

    expect(page).toContain('<p>Hunters now go round a barricaded location.</p>');
    expect(page).not.toContain('The second paragraph stays out.');
    expect(page).toContain('<p>The gate posted no status on its head.</p>');
  });

  it('says so when nothing merged without the owner', () => {
    const page = renderDigest({ repo, date: '2026-11-27', prs: [] });

    expect(page).toContain('<p>Nothing merged without you.</p>');
  });
});

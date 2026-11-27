import { escapeHtml } from './highlight.ts';
import { PAGE_CSS } from './page_assets.ts';
import { inline, splitTitle } from './render.ts';
import { parseTour } from './tour.ts';

/**
 * The daily digest (MA.6): one page listing the PRs that merged without the owner's approval,
 * so the owner keeps oversight of what the merge gate let through without a review queue.
 * `digest.yml` collects a day's merged PRs through the API, `digest_cli.ts` turns them into
 * the page with `renderDigest`, and the workflow publishes it on gh-pages next to the tours.
 */

/** A merged PR as the digest workflow reads it from the API. */
export interface MergedPr {
  readonly number: number;
  readonly title: string;
  /** The description, with its `<!-- review-tour {…} -->` block when the session wrote one. */
  readonly body: string;
  /** The PR's last head commit, the one the owner would have had to approve. */
  readonly headSha: string;
  readonly reviews: readonly PrReview[];
  /** The `gate` commit status on the head (`gate.yml`), absent when the gate never ran on it. */
  readonly gate?: { readonly state: string; readonly description: string };
  /** The changed files, with the diff GitHub returns for each (missing for binary or huge ones). */
  readonly files: readonly { readonly filename: string; readonly patch?: string }[];
}

/** One review on a PR: who, `APPROVED` / `CHANGES_REQUESTED` / `COMMENTED`, and on which commit. */
export interface PrReview {
  readonly author: string;
  readonly state: string;
  readonly commit: string;
}

/**
 * The PRs the owner never approved at their head: those the gate passed on the session's
 * verdict. An approval of an earlier commit doesn't count, as the gate doesn't count it either.
 */
export function mergedWithoutOwner(prs: readonly MergedPr[], owner: string): MergedPr[] {
  return prs.filter(
    (pr) =>
      !pr.reviews.some(
        (review) =>
          review.author === owner && review.state === 'APPROVED' && review.commit === pr.headSha,
      ),
  );
}

const RULES_PAGE = /^docs\/rules\/.+\.md$/;
const ADDED_LIST_ITEM = /^\+\s*- (.+)$/;

/**
 * The rule claims a PR added to the rules pages (`docs/rules/`): its added list items, sub-claims
 * too. A reworded claim shows up as added, which is right: the owner should see the new wording.
 * `Test:` lines aren't list items, so they never count as claims.
 */
export function addedRuleClaims(files: MergedPr['files']): string[] {
  return files
    .filter((file) => RULES_PAGE.test(file.filename))
    .flatMap((file) =>
      (file.patch ?? '').split('\n').flatMap((line) => {
        const claim = ADDED_LIST_ITEM.exec(line)?.[1];
        return claim === undefined ? [] : [claim];
      }),
    );
}

/** What the digest needs: the repository (`owner/name`), the day it covers and its PRs. */
export interface DigestInput {
  readonly repo: string;
  /** The day the page covers, `YYYY-MM-DD`, as its heading shows it. */
  readonly date: string;
  readonly prs: readonly MergedPr[];
}

/** The digest page as one HTML document, the PRs in the order given (the workflow sorts them). */
export function renderDigest({ repo, date, prs }: DigestInput): string {
  const entries =
    prs.length === 0
      ? '<section class="lead"><p>Nothing merged without you.</p></section>'
      : prs.map((pr) => renderEntry(repo, pr)).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Digest ${escapeHtml(date)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400..700&amp;family=JetBrains+Mono:wght@400;600&amp;display=swap">
<style>${PAGE_CSS}</style>
</head>
<body>
<main>
<header>
<p class="kicker">${escapeHtml(repo)} · ${escapeHtml(date)}</p>
<h1>Merged without you</h1>
<p class="meta"><span>${prs.length} PR${prs.length === 1 ? '' : 's'}</span></p>
</header>
${entries}
</main>
</body>
</html>
`;
}

function renderEntry(repo: string, pr: MergedPr): string {
  const url = `https://github.com/${repo}/pull/${pr.number}`;
  const title = splitTitle(pr.title);
  const { problem, concept } = tourLead(pr);
  const claims = addedRuleClaims(pr.files);
  const followUp = `https://github.com/${repo}/issues/new?${new URLSearchParams({
    title: `Follow-up to #${pr.number}: ${title.headline}`,
    body: `Follow-up to #${pr.number}.\n\n`,
  }).toString()}`;
  const parts = [
    `<p class="kicker">${[`#${pr.number}`, ...title.labels].map(escapeHtml).join(' · ')}</p>`,
    `<h2><a href="${escapeHtml(url)}">${escapeHtml(title.headline)}</a></h2>`,
    problem === undefined ? '' : `<h3>The problem</h3><p>${inline(problem)}</p>`,
    `<h3>What changes</h3><p>${inline(concept)}</p>`,
    `<h3>Why it merged</h3><p>${escapeHtml(pr.gate?.description ?? 'The gate posted no status on its head.')}</p>`,
    claims.length === 0
      ? ''
      : `<h3>Rule claims added</h3><ul>${claims.map((claim) => `<li>${inline(claim)}</li>`).join('')}</ul>`,
    // GitHub offers its Revert button on the merged PR's page; there is no link that starts it.
    `<p class="links"><a href="${escapeHtml(url)}">Revert</a> <a href="${escapeHtml(followUp)}">Follow-up</a></p>`,
  ];
  return `<section class="entry">${parts.join('')}</section>`;
}

// A PR without a tour (opened by hand, or before tours existed) still gets an entry: the
// description's first paragraph stands in for "what changes".
function tourLead(pr: MergedPr): { problem?: string; concept: string } {
  try {
    const tour = parseTour(pr.body);
    if (tour !== undefined) return tour;
  } catch (error) {
    console.warn(
      `#${pr.number}: its review-tour block doesn't parse, using the description`,
      error,
    );
  }
  const firstParagraph = pr.body.split(/\n\s*\n/)[0]?.trim() ?? '';
  return { concept: firstParagraph === '' ? 'No description.' : firstParagraph };
}

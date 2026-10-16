# Development automation

What runs automatically, where, and what you need to do yourself.

## On every pull request

| Check                                         | Workflow                           | Blocks merge                      | What it does                                                                                                                                                                                          |
| --------------------------------------------- | ---------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Typecheck, lint, unit tests + coverage floors | `ci.yml` → `check`                 | yes                               | Floors in `vitest.config.ts` (engine ≥ 95 % lines, rest ≥ 80 %). Coverage summary on the run page.                                                                                                    |
| E2E                                           | `ci.yml` → `e2e`                   | yes                               | Playwright on the production build, tablet-landscape viewport. Report uploaded on failure.                                                                                                            |
| PR title                                      | `pr-title.yml`                     | yes                               | Title must be a Conventional Commit (`feat(engine): …`).                                                                                                                                              |
| CodeQL                                        | `codeql.yml`                       | no (alerts in Security tab)       | Security and quality analysis; also weekly on `main`.                                                                                                                                                 |
| Preview deploy                                | `preview.yml`                      | no                                | Publishes the PR to `…/arkham-companion/pr-preview/pr-<n>/` and comments the link; removed when the PR closes.                                                                                        |
| Screencasts                                   | `preview.yml`                      | no                                | When `apps/web` changes: records the `@flow` E2E specs as GIF + WebM next to the preview and writes them into the PR description between the `screencasts` markers.                                   |
| Bundle size                                   | `pr-quality.yml` → `bundle-size`   | no                                | Comments the gzip size change per file vs. `main`.                                                                                                                                                    |
| Review digest                                 | `pr-quality.yml` → `review-digest` | no                                | Comments the PR size against the budget (`docs/coding-guidelines.md` §7), the changed engine and scenario lines no test runs, and the test names added and removed. Code in `packages/review_digest`. |
| Lighthouse                                    | `pr-quality.yml` → `lighthouse`    | accessibility < 0.9 fails the job | Performance, accessibility, best practices, SEO on the build. Thresholds in `lighthouserc.json`.                                                                                                      |
| Card data check                               | `carddata-check.yml`               | no                                | Real ArkhamDB fetch when `packages/carddata` changes.                                                                                                                                                 |

### Screencasts

UI changes are easier to review as a recording than as a diff. E2E specs tagged `@flow` (`test('…', { tag: '@flow' }, …)`) are re-run by the `screencast` Playwright project with `slowMo` of 250 ms and video on, with a pointer and a highlight drawn on every interaction and the current `test.step` name as a caption (`video.show`, `pnpm e2e:screencast`). `apps/web/scripts/screencast/cli.ts` converts each passing flow into a GIF at 4 fps (one frame per 250 ms step, 800 px wide) plus the original WebM, and renders the Markdown section; the preview workflow publishes both under `pr-preview/pr-<n>/screencasts/` and replaces the section between `<!-- screencasts:start -->` and `<!-- screencasts:end -->` in the PR description (appending it if the markers are missing). Text outside the markers is never touched. A failing flow does not block the preview; it shows up as "not recorded" and in the E2E check. Rules for flow specs are in `docs/coding-guidelines.md` §3.

### Review aids

- **Review map**: the PR template's section that tells the reviewer what to read first, which rules changed, the API changes and the decisions left to them. Claude fills it in when it opens a PR.
- **`REVIEW.md`**: what an automated reviewer (Claude Code Review) flags as blocking, flags as optional, or ignores. Claude sessions also check their own diff against it before opening a PR.
- **`.gitattributes`**: the lockfile, changelog, release manifest and `docs/tasks/done/` are marked `linguist-generated`, so GitHub collapses them in the diff.

## On `main`

- **Deploy** (`deploy.yml`): builds and publishes to the root of the `gh-pages` branch → https://macandy13.github.io/arkham-companion/
- **Release Please** (`release.yml`): keeps a release PR with version bump and `CHANGELOG.md` from the Conventional Commit titles. Merging it tags the release. Release PRs are opened by the Actions bot, so CI does not run on them – merge them with the admin bypass.

## Weekly

- **Dependabot** (`.github/dependabot.yml`): Monday, grouped npm minor/patch, npm major and GitHub Actions updates. CI checks them; merge when green.
- **CodeQL** scheduled scan.
- **Docs sync** (a Claude routine, configured at claude.ai/code/routines): compares merged PRs with `docs/tasks/` and `docs/architecture.md`, opens a `docs:` PR for drift and an issue per unhandled follow-up.

## Inside Claude Code sessions (`.claude/`)

- **SessionStart hook**: installs dependencies in fresh sessions.
- **Stop hook**: runs typecheck, lint and tests when code changed; failures go back to Claude to fix.
- **Subagents**: `rules-checker` (game rules vs. code, read-only) and `test-writer` (missing tests).
- **Auto-fix**: for PRs opened from a cloud session, turn on Auto-fix in the session's CI bar (or tell Claude "watch this PR and fix CI failures") so it fixes failing checks on its own.

## Repository settings (one-time, by the owner)

- Pages → Source: **Deploy from a branch**, `gh-pages` / root.
- Actions → General → **Allow GitHub Actions to create and approve pull requests** (Release Please).
- Merge button: **squash merging only**, default commit message **Pull request title**; auto-delete head branches.
- Ruleset on `main`: require PR, require status checks `check`, `e2e`, `title`; block force pushes; admins may bypass (for release PRs).

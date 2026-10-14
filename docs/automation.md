# Development automation

What runs automatically, where, and what you need to do yourself.

## On every pull request

| Check                                         | Workflow                         | Blocks merge                      | What it does                                                                                                   |
| --------------------------------------------- | -------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Typecheck, lint, unit tests + coverage floors | `ci.yml` → `check`               | yes                               | Floors in `vitest.config.ts` (engine ≥ 95 % lines, rest ≥ 80 %). Coverage summary on the run page.             |
| E2E                                           | `ci.yml` → `e2e`                 | yes                               | Playwright on the production build, tablet-landscape viewport. Report uploaded on failure.                     |
| PR title                                      | `pr-title.yml`                   | yes                               | Title must be a Conventional Commit (`feat(engine): …`).                                                       |
| CodeQL                                        | `codeql.yml`                     | no (alerts in Security tab)       | Security and quality analysis; also weekly on `main`.                                                          |
| Preview deploy                                | `preview.yml`                    | no                                | Publishes the PR to `…/arkham-companion/pr-preview/pr-<n>/` and comments the link; removed when the PR closes. |
| Bundle size                                   | `pr-quality.yml` → `bundle-size` | no                                | Comments the gzip size change per file vs. `main`.                                                             |
| Lighthouse                                    | `pr-quality.yml` → `lighthouse`  | accessibility < 0.9 fails the job | Performance, accessibility, best practices, SEO on the build. Thresholds in `lighthouserc.json`.               |
| Card data check                               | `carddata-check.yml`             | no                                | Real ArkhamDB fetch when `packages/carddata` changes.                                                          |

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

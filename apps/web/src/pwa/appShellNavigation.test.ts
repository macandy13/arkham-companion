import { describe, expect, it } from 'vitest';
import { appShellNavigation } from './appShellNavigation';

describe('appShellNavigation', () => {
  const base = '/arkham-companion/pr-preview/pr-40/';

  it.each([
    { path: '/arkham-companion/pr-preview/pr-40/', served: true },
    { path: '/arkham-companion/pr-preview/pr-40/index.html', served: true },
    { path: '/arkham-companion/pr-preview/pr-40/?source=pwa', served: true },
    { path: '/arkham-companion/pr-preview/pr-40/screencasts/flow.webm', served: false },
    { path: '/arkham-companion/pr-preview/pr-40/screencasts/flow.webm?v=abc1234', served: false },
    { path: '/arkham-companion/pr-preview/pr-41/', served: false },
    { path: '/arkham-companion/', served: false },
  ])('serves the app shell for $path: $served', ({ path, served }) => {
    expect(appShellNavigation(base).test(path)).toBe(served);
  });

  it('treats regex characters in the base literally', () => {
    expect(appShellNavigation('/a.b/').test('/axb/')).toBe(false);
  });

  it('only matches the root when deployed at the site root', () => {
    expect(appShellNavigation('/').test('/')).toBe(true);
    expect(appShellNavigation('/').test('/pr-preview/pr-40/')).toBe(false);
  });
});

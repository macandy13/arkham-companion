// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AppRoutes } from './App';
import { initI18n } from './i18n';
import { IndexedDbStore } from './storage/IndexedDbStore';
import { createAppStore } from './state/appStore';

const neverLoads = () => new Promise<never>(() => {});

function renderAt(path: string) {
  const store = createAppStore(new IndexedDbStore('app-routes-test'), neverLoads);
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes store={store} />
    </MemoryRouter>,
  );
}

describe('AppRoutes', () => {
  beforeAll(async () => {
    await initI18n('en');
  });
  afterEach(cleanup);

  it.each([
    ['/', 'Games'],
    ['/new', 'New game'],
    ['/game/some-id', 'Arkham Companion'],
    ['/settings', 'Settings'],
  ])('shows the screen heading for %s', (path, heading) => {
    renderAt(path);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(heading);
  });

  it('offers main navigation on every screen', () => {
    renderAt('/settings');

    expect(screen.getByRole('navigation', { name: 'Main' })).toBeTruthy();
  });
});

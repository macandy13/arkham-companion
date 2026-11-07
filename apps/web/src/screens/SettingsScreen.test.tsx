// @vitest-environment jsdom
import type { PackDef } from '@arkham/carddata';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { i18next, initI18n } from '../i18n';
import { loadSettings, saveSettings, DEFAULT_SETTINGS } from '../settings/settings';
import { SettingsScreen } from './SettingsScreen';

const packs: PackDef[] = [
  { code: 'core', name: 'Core Set', position: 1, cyclePosition: 1, chapter: 1 },
  { code: 'rcore', name: 'Revised Core Set', position: 2, cyclePosition: 1, chapter: 1 },
  { code: 'dwl', name: 'The Dunwich Legacy', position: 1, cyclePosition: 2, chapter: 1 },
];

/** Settings at its route, with the packs above for the collection's line. */
function renderSettings() {
  render(
    <MemoryRouter initialEntries={['/settings']}>
      <SettingsScreen packs={packs} />
    </MemoryRouter>,
  );
}

describe('SettingsScreen', () => {
  beforeAll(async () => {
    await initI18n('en');
  });
  beforeEach(() => localStorage.clear());
  afterEach(async () => {
    cleanup();
    await i18next.changeLanguage('en');
  });

  it.each([
    { owned: [], line: 'Nothing ticked yet0 of 1 campaign' },
    { owned: ['core', 'rcore'], line: 'Core Set, Revised Core Set1 of 1 campaign' },
  ])('writes the collection $owned as one line that opens its page', ({ owned, line }) => {
    saveSettings({ ...DEFAULT_SETTINGS, ownedPacks: owned });
    renderSettings();

    const collection = screen.getByRole('link', { name: /campaign/ });
    expect(collection.textContent).toBe(line);
    expect(collection.getAttribute('href')).toBe('/settings/collection');
  });

  it('says the app is an unofficial fan project and credits the publisher', () => {
    renderSettings();

    const about = screen.getByRole('region', { name: 'About' });
    expect(about.textContent).toContain('unofficial fan project');
    expect(about.textContent).toContain('© Fantasy Flight Games');
  });

  it('saves the card language', () => {
    renderSettings();

    fireEvent.change(screen.getByRole('combobox', { name: 'Card language' }), {
      target: { value: 'fr' },
    });

    expect(loadSettings().cardLanguage).toBe('fr');
  });

  it('switches the UI language', () => {
    renderSettings();

    fireEvent.change(screen.getByRole('combobox', { name: 'App language' }), {
      target: { value: 'de' },
    });

    expect(i18next.language).toBe('de');
    expect(loadSettings().uiLanguage).toBe('de');
  });

  it('applies and saves the theme', () => {
    renderSettings();

    fireEvent.click(screen.getByRole('radio', { name: 'By day' }));

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(loadSettings().theme).toBe('light');
  });

  it('applies and saves the card theme', () => {
    renderSettings();

    fireEvent.change(screen.getByRole('combobox', { name: 'Card style' }), {
      target: { value: 'pictures' },
    });

    expect(document.documentElement.dataset.cardTheme).toBe('pictures');
    expect(loadSettings().cardTheme).toBe('pictures');
  });

  it('applies and saves the enemy token face', () => {
    renderSettings();

    fireEvent.change(screen.getByRole('combobox', { name: 'Enemy tokens' }), {
      target: { value: 'initials' },
    });

    expect(document.documentElement.dataset.enemyTokens).toBe('initials');
    expect(loadSettings().enemyTokens).toBe('initials');
  });
});

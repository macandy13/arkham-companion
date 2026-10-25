// @vitest-environment jsdom
import type { PackDef } from '@arkham/carddata';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { i18next, initI18n } from '../i18n';
import { loadSettings } from '../settings/settings';
import { SettingsScreen } from './SettingsScreen';

const packs: PackDef[] = [
  { code: 'core', name: 'Core Set', position: 1, cyclePosition: 1, chapter: 1 },
  { code: 'rcore', name: 'Revised Core Set', position: 2, cyclePosition: 1, chapter: 1 },
  { code: 'dwl', name: 'The Dunwich Legacy', position: 1, cyclePosition: 2, chapter: 1 },
];

describe('SettingsScreen', () => {
  beforeAll(async () => {
    await initI18n('en');
  });
  beforeEach(() => localStorage.clear());
  afterEach(async () => {
    cleanup();
    await i18next.changeLanguage('en');
  });

  it('lists only the packs of campaigns the app plays, grouped by campaign', () => {
    render(<SettingsScreen packs={packs} />);

    expect(screen.getAllByRole('group').map((g) => g.textContent)).toEqual([
      'Night of the ZealotCore SetRevised Core Set',
    ]);
  });

  it('says the app is an unofficial fan project and credits the publisher', () => {
    render(<SettingsScreen packs={packs} />);

    const about = screen.getByRole('region', { name: 'About' });
    expect(about.textContent).toContain('unofficial fan project');
    expect(about.textContent).toContain('© Fantasy Flight Games');
  });

  it('saves the owned packs', () => {
    render(<SettingsScreen packs={packs} />);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Revised Core Set' }));

    expect(loadSettings().ownedPacks).toEqual(['rcore']);
  });

  it('removes a pack that is unchecked again', () => {
    render(<SettingsScreen packs={packs} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Revised Core Set' }));

    fireEvent.click(screen.getByRole('checkbox', { name: 'Revised Core Set' }));

    expect(loadSettings().ownedPacks).toEqual([]);
  });

  it('saves the card language', () => {
    render(<SettingsScreen packs={packs} />);

    fireEvent.change(screen.getByRole('combobox', { name: 'Card language' }), {
      target: { value: 'fr' },
    });

    expect(loadSettings().cardLanguage).toBe('fr');
  });

  it('switches the UI language', () => {
    render(<SettingsScreen packs={packs} />);

    fireEvent.change(screen.getByRole('combobox', { name: 'App language' }), {
      target: { value: 'de' },
    });

    expect(i18next.language).toBe('de');
    expect(loadSettings().uiLanguage).toBe('de');
  });

  it('applies and saves the theme', () => {
    render(<SettingsScreen packs={packs} />);

    fireEvent.change(screen.getByRole('combobox', { name: 'Theme' }), {
      target: { value: 'light' },
    });

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(loadSettings().theme).toBe('light');
  });

  it('applies and saves the card look', () => {
    render(<SettingsScreen packs={packs} />);

    fireEvent.change(screen.getByRole('combobox', { name: 'Card pictures' }), {
      target: { value: 'faces' },
    });

    expect(document.documentElement.dataset.cardLook).toBe('faces');
    expect(loadSettings().cardLook).toBe('faces');
  });

  it('explains that the pack list is missing without catalog packs', () => {
    render(<SettingsScreen />);

    expect(screen.getByText(/pack list appears/i)).toBeTruthy();
  });
});

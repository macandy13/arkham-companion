// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './settings';

const KEY = 'arkham-companion.settings';

describe('settings storage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('returns the defaults when nothing is stored', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips saved settings', () => {
    const settings = {
      ownedPacks: ['core_2026', 'dwl'],
      cardLanguage: 'de',
      uiLanguage: 'de',
      theme: 'light',
    } as const;

    saveSettings(settings);

    expect(loadSettings()).toEqual(settings);
  });

  it('falls back to the defaults for corrupt JSON', () => {
    localStorage.setItem(KEY, '{not json');

    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('falls back to the defaults for stored values that are not an object', () => {
    localStorage.setItem(KEY, '42');

    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('replaces invalid fields but keeps valid ones', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ ownedPacks: [1], cardLanguage: 'xx', uiLanguage: 'fr', theme: 'light' }),
    );

    expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS, theme: 'light' });
  });

  it('returns the defaults when reading throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('does not throw when writing fails', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });

    expect(() => saveSettings(DEFAULT_SETTINGS)).not.toThrow();
  });
});

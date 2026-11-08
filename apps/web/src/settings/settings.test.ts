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
      tableSkin: 'stars',
      cardTheme: 'pictures',
      enemyTokens: 'initials',
    } as const;

    saveSettings(settings);

    expect(loadSettings()).toEqual(settings);
  });

  it('falls back to the defaults and warns for corrupt JSON', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem(KEY, '{not json');

    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('using the defaults'),
      expect.any(SyntaxError),
    );
  });

  it('falls back to the defaults for stored values that are not an object', () => {
    localStorage.setItem(KEY, '42');

    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('replaces invalid fields but keeps valid ones', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        ownedPacks: [1],
        cardLanguage: 'xx',
        uiLanguage: 'fr',
        tableSkin: 'moon',
        cardTheme: 'scans',
        enemyTokens: 'initials',
      }),
    );

    expect(loadSettings()).toEqual({ ...DEFAULT_SETTINGS, enemyTokens: 'initials' });
  });

  it.each([
    { theme: 'light', saved: 'nightAndBrass', tableSkin: 'parchment' },
    { theme: 'light', saved: 'stars', tableSkin: 'parchment' },
    { theme: 'dark', saved: 'stars', tableSkin: 'stars' },
  ] as const)(
    'reads the old $theme theme beside the $saved skin as the $tableSkin table',
    ({ theme, saved, tableSkin }) => {
      localStorage.setItem(KEY, JSON.stringify({ theme, tableSkin: saved }));

      expect(loadSettings().tableSkin).toBe(tableSkin);
    },
  );

  it.each([
    { cardLook: 'frames', cardTheme: 'exact' },
    { cardLook: 'faces', cardTheme: 'pictures' },
  ] as const)(
    'reads the old card look $cardLook as the $cardTheme theme',
    ({ cardLook, cardTheme }) => {
      localStorage.setItem(KEY, JSON.stringify({ cardLook }));

      expect(loadSettings().cardTheme).toBe(cardTheme);
    },
  );

  it('returns the defaults and warns when reading throws', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const failure = new Error('blocked');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw failure;
    });

    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('using the defaults'), failure);
  });

  it('warns instead of throwing when writing fails', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const failure = new DOMException('quota', 'QuotaExceededError');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw failure;
    });

    expect(() => saveSettings(DEFAULT_SETTINGS)).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('this session only'), failure);
  });
});

import { describe, expect, it, vi } from 'vitest';
import type { CardCatalog, CardLanguage } from '@arkham/carddata';
import { sharedCatalog } from './useCatalog';

const english: CardCatalog = {
  packs: [{ code: 'core', name: 'Core Set', position: 1, cyclePosition: 1, chapter: 1 }],
  investigators: [],
};
const german: CardCatalog = {
  packs: [{ code: 'core', name: 'Grundspiel', position: 1, cyclePosition: 1, chapter: 1 }],
  investigators: [],
};

describe('sharedCatalog', () => {
  it('loads each language once and hands every screen the same catalog', async () => {
    let language: CardLanguage = 'en';
    const load = vi.fn((lang: CardLanguage) => Promise.resolve(lang === 'en' ? english : german));
    const source = sharedCatalog(load, () => language);

    const first = await source();
    const second = await source();
    language = 'de';
    const third = await source();

    expect([first, second, third]).toEqual([english, english, german]);
    expect(load.mock.calls).toEqual([['en'], ['de']]);
  });

  it('asks again after a failed load', async () => {
    const load = vi
      .fn<(lang: CardLanguage) => Promise<CardCatalog>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(english);
    const source = sharedCatalog(load, () => 'en');

    await expect(source()).rejects.toThrow('offline');

    expect(await source()).toBe(english);
    expect(load).toHaveBeenCalledTimes(2);
  });
});

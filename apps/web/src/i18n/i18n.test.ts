import { describe, expect, it } from 'vitest';
import { duplicates } from '@arkham/util';
import { appTexts as appDe } from './de/app';
import { appTexts as appEn } from './en/app';
import { CAMPAIGN_SECTIONS, campaignTexts, resources } from './index';

/** Every key path of a strings object, e.g. `campaignLog.notes`. */
function keys(strings: object, prefix = ''): string[] {
  return Object.entries(strings).flatMap(([key, value]) =>
    typeof value === 'object' ? keys(value as object, `${prefix}${key}.`) : [`${prefix}${key}`],
  );
}

describe('i18n resources', () => {
  it('de has exactly the keys of en', () => {
    expect(keys(resources.de).sort()).toEqual(keys(resources.en).sort());
  });

  // Campaign sections are joined one level deep, so a key two campaigns share there would lose one.
  it.each(['en', 'de'] as const)('no two %s campaigns share a key in a section', (language) => {
    const sectionKeys = campaignTexts[language].flatMap((campaign) =>
      CAMPAIGN_SECTIONS.flatMap((section) =>
        Object.keys(campaign[section]).map((key) => `${section}.${key}`),
      ),
    );
    expect(duplicates(sectionKeys)).toEqual([]);
  });

  it.each([
    ['en', appEn],
    ['de', appDe],
  ])('the %s app strings leave the campaign sections to the campaigns', (_language, app) => {
    expect(CAMPAIGN_SECTIONS.filter((section) => section in app)).toEqual([]);
  });
});

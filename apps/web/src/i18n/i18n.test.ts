import { describe, expect, it } from 'vitest';
import { duplicates } from '@arkham/util';
import { CAMPAIGN_SECTIONS, campaignTexts, resources } from './index';

/** Every key path of a strings object, e.g. `campaignLog.notes`. */
function keys(o: object, p = ''): string[] {
  return Object.entries(o).flatMap(([k, v]) =>
    typeof v === 'object' ? keys(v as object, `${p}${k}.`) : [`${p}${k}`],
  );
}

describe('i18n resources', () => {
  it('de has exactly the keys of en', () => {
    expect(keys(resources.de).sort()).toEqual(keys(resources.en).sort());
  });

  it.each(['en', 'de'] as const)('no two %s campaigns write the same key', (language) => {
    const campaignKeys = campaignTexts[language].flatMap((campaign) =>
      CAMPAIGN_SECTIONS.flatMap((section) => keys(campaign[section], `${section}.`)),
    );
    expect(duplicates(campaignKeys)).toEqual([]);
  });
});

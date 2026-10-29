import { describe, expect, it } from 'vitest';
import { scenarioCatalog } from '../scenarios/scenarioCatalog';
import { initI18n, resources } from './index';

describe('i18n resources', () => {
  it('de has exactly the keys of en', () => {
    const keys = (o: object, p = ''): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        typeof v === 'object' ? keys(v as object, `${p}${k}.`) : [`${p}${k}`],
      );
    expect(keys(resources.de).sort()).toEqual(keys(resources.en).sort());
  });

  it.each(scenarioCatalog.map(({ id, definition }) => ({ id, definition })))(
    "has a text for every effect on $id's reference card",
    async ({ definition }) => {
      const i18n = await initI18n('en');
      const effectKeys = Object.values(definition.reference).flatMap((side) =>
        Object.values(side).map(({ effectKey }) => effectKey),
      );

      const missing = effectKeys.filter((key) => !i18n.exists(key, { lng: 'en' }));
      expect(missing).toEqual([]);
    },
  );
});

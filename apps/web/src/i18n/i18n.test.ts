import { describe, expect, it } from 'vitest';
import { resources } from './index';

describe('i18n resources', () => {
  it('de has exactly the keys of en', () => {
    const keys = (o: object, p = ''): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        typeof v === 'object' ? keys(v as object, `${p}${k}.`) : [`${p}${k}`],
      );
    expect(keys(resources.de).sort()).toEqual(keys(resources.en).sort());
  });
});

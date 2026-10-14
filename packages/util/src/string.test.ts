import { describe, expect, it } from 'vitest';
import { stripPrefix, stripSuffix } from './string';

describe('stripPrefix', () => {
  it('removes a matching prefix', () => {
    expect(stripPrefix('core_2026', 'core_')).toBe('2026');
  });

  it('leaves text without the prefix unchanged', () => {
    expect(stripPrefix('core_2026', 'dwl_')).toBe('core_2026');
  });

  it('treats an empty prefix as no-op', () => {
    expect(stripPrefix('core', '')).toBe('core');
  });
});

describe('stripSuffix', () => {
  it('removes a matching suffix', () => {
    expect(stripSuffix('pack.json', '.json')).toBe('pack');
  });

  it('leaves text without the suffix unchanged', () => {
    expect(stripSuffix('pack.json', '.csv')).toBe('pack.json');
  });

  it('treats an empty suffix as no-op', () => {
    expect(stripSuffix('pack', '')).toBe('pack');
  });
});

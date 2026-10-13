import { describe, expect, it } from 'vitest';
import { PACKAGE_NAME } from './index';

describe('@arkham/carddata', () => {
  it('exports its package name', () => {
    expect(PACKAGE_NAME).toBe('@arkham/carddata');
  });
});

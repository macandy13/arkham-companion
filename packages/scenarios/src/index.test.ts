import { describe, expect, it } from 'vitest';
import { PACKAGE_NAME } from './index';

describe('@arkham/scenarios', () => {
  it('exports its package name', () => {
    expect(PACKAGE_NAME).toBe('@arkham/scenarios');
  });
});

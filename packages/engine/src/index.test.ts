import { describe, expect, it } from 'vitest';
import { PACKAGE_NAME } from './index';

describe('@arkham/engine', () => {
  it('exports its package name', () => {
    expect(PACKAGE_NAME).toBe('@arkham/engine');
  });
});

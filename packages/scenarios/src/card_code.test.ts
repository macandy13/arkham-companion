import type { CardCode as CarddataCardCode } from '@arkham/carddata';
import type { CardCode as EngineCardCode } from '@arkham/engine';
import { describe, expectTypeOf, it } from 'vitest';

// carddata can't import the engine, so it declares the brand itself; the scenarios see both.
describe('card codes', () => {
  it('are the same type in carddata and the engine', () => {
    expectTypeOf<CarddataCardCode>().toEqualTypeOf<EngineCardCode>();
  });
});

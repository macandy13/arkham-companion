import { describe, expect, it } from 'vitest';
import { campaignCycleName, type PackDef } from './index';

const pack = (code: string, name: string, cyclePosition: number, position: number): PackDef => ({
  code,
  name,
  position,
  cyclePosition,
  chapter: 1,
});

/** Packs as ArkhamDB lists them (names only, no card data), one or two per cycle. */
const packs: PackDef[] = [
  pack('rcore', 'Revised Core Set', 1, 2),
  pack('core', 'Core Set', 1, 1),
  pack('dwl', 'The Dunwich Legacy', 2, 1),
  pack('dwlp', 'The Dunwich Legacy Investigator Expansion', 2, 1),
  pack('tmm', 'The Miskatonic Museum', 2, 2),
  pack('eoep', 'Edge of the Earth Investigator Expansion', 8, 1),
  pack('eoec', 'Edge of the Earth Campaign Expansion', 8, 2),
  pack('cob', 'Children of Blood', 13, 1),
  pack('rtnotz', 'Return to the Night of the Zealot', 50, 1),
  pack('rtdwl', 'Return to the Dunwich Legacy', 50, 2),
];

describe('campaignCycleName', () => {
  it.each([
    { what: 'the first pack when the first two share no words', cycle: 1, name: 'Core Set' },
    {
      what: 'the deluxe box its investigator expansion repeats',
      cycle: 2,
      name: 'The Dunwich Legacy',
    },
    { what: 'the words two expansions share', cycle: 8, name: 'Edge of the Earth' },
    { what: 'the only pack of a cycle', cycle: 13, name: 'Children of Blood' },
    {
      what: 'nothing for a product line, whose packs share only "Return to the"',
      cycle: 50,
      name: undefined,
    },
    { what: 'nothing for a cycle without packs', cycle: 3, name: undefined },
  ])('names $what', ({ cycle, name }) => {
    expect(campaignCycleName(packs, cycle)).toBe(name);
  });
});

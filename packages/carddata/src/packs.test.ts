import { describe, expect, it } from 'vitest';
import { campaignCycleName, type PackDef } from './index';

/** A pack of cycle 2 at `position`, named only (no card data). */
const pack = (name: string, position: number): PackDef => ({
  code: name,
  name,
  position,
  cyclePosition: 2,
  chapter: 1,
});

describe('campaignCycleName', () => {
  it.each([
    {
      what: 'the deluxe box its investigator expansion repeats, though a Mythos pack comes between them in the data',
      packs: [
        pack('The Dunwich Legacy', 1),
        pack('The Miskatonic Museum', 2),
        pack('The Dunwich Legacy Investigator Expansion', 1),
      ],
      name: 'The Dunwich Legacy',
    },
    {
      what: 'the words two expansions share',
      packs: [
        pack('Edge of the Earth Investigator Expansion', 1),
        pack('Edge of the Earth Campaign Expansion', 2),
      ],
      name: 'Edge of the Earth',
    },
    {
      what: 'the shared words without the dash before their difference',
      packs: [
        pack('Am Rande der Welt – Ermittler-Erweiterung', 1),
        pack('Am Rande der Welt – Kampagnen-Erweiterung', 2),
      ],
      name: 'Am Rande der Welt',
    },
    {
      what: 'the first pack when the first two share no words',
      packs: [pack('Revised Core Set', 2), pack('Core Set', 1)],
      name: 'Core Set',
    },
    {
      what: 'the only pack of a cycle',
      packs: [pack('Children of Blood', 1)],
      name: 'Children of Blood',
    },
    { what: 'nothing for a cycle without packs', packs: [], name: undefined },
  ])('names $what', ({ packs, name }) => {
    expect(campaignCycleName(packs, 2)).toBe(name);
  });

  it('names no product line, whose packs share only "Return to the"', () => {
    const returnTo: PackDef[] = [
      {
        code: 'rtnotz',
        name: 'Return to the Night of the Zealot',
        position: 1,
        cyclePosition: 50,
        chapter: 1,
      },
      {
        code: 'rtdwl',
        name: 'Return to the Dunwich Legacy',
        position: 2,
        cyclePosition: 50,
        chapter: 1,
      },
    ];

    expect(campaignCycleName(returnTo, 50)).toBeUndefined();
  });
});

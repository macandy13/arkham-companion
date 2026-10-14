import { describe, expect, it } from 'vitest';
import { theGatheringCards } from './cards';

describe('The Gathering card data', () => {
  it.each([
    { code: '01116', name: 'Ghoul Priest', keywords: ['elite', 'hunter', 'prey', 'retaliate'] },
    { code: '01118', name: 'Flesh-Eater', keywords: ['spawn'] },
    { code: '01119', name: 'Icy Ghoul', keywords: ['spawn'] },
    { code: '01159', name: 'Swarm of Rats', keywords: ['hunter'] },
    { code: '01160', name: 'Ghoul Minion', keywords: ['aloof'] },
    { code: '01161', name: 'Ravenous Ghoul', keywords: ['prey'] },
    { code: '01162', name: 'Grasping Hands', keywords: [] },
  ])('lists the keywords of $name', ({ code, keywords }) => {
    const names = theGatheringCards.get(code)?.keywords?.map((keyword) => keyword.name) ?? [];

    expect(names).toEqual(keywords);
  });

  it.each([
    { code: '01118', detail: 'Attic' },
    { code: '01119', detail: 'Cellar' },
  ])('names the spawn location of $code', ({ code, detail }) => {
    const spawn = theGatheringCards.get(code)?.keywords?.find((k) => k.name === 'spawn');

    expect(spawn?.detail).toBe(detail);
  });

  it.each([
    { code: '01164', name: 'Frozen in Fear', staysInPlay: true },
    { code: '01165', name: 'Dissonant Voices', staysInPlay: true },
    { code: '01163', name: 'Rotting Remains', staysInPlay: false },
  ])('flags whether $name stays in the threat area', ({ code, staysInPlay }) => {
    expect(theGatheringCards.get(code)?.entersThreatArea ?? false).toBe(staysInPlay);
  });
});

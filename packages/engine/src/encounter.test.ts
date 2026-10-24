import { describe, expect, it } from 'vitest';
import {
  attachedTo,
  attachToLocation,
  blankAsset,
  blankEnemy,
  blankLocation,
  blankTreachery,
  checkInvariants,
  CommandRejected,
  encounterDeck,
  encounterDiscard,
  engagedWith,
  execute,
  instanceId,
  investigatorId,
  moveSelf,
  newGame,
  putIntoThreatArea,
  replay,
  setAside,
  skillTest,
  takeDamage,
  threatAreaOf,
  trait,
  whenRevealed,
  zoneKey,
  type CardStats,
  type Command,
  type Event,
  type GameState,
  type Zone,
} from './index';
import { answer, rejectionFrom, stateAfter } from '../test/utils';

const hall = instanceId('hall');
const alice = investigatorId('alice');
const hallCard = blankLocation('hall');

/**
 * The encounter cards of these tests. A name says what the card is; every
 * card has no other property than the one in its name (a plain treachery has
 * no keyword and does not stay in play).
 */
const foeCard = blankEnemy('foe');
const plainTreachery = blankTreachery('plain_treachery');
const surgeTreachery = blankTreachery('surge_treachery', { keywords: [{ name: 'surge' }] });
const surgeFoe = blankEnemy('surge_foe', { keywords: [{ name: 'surge' }] });
const perilTreachery = blankTreachery('peril_treachery', { keywords: [{ name: 'peril' }] });
const lingeringTreachery = blankTreachery('lingering_treachery', {
  abilities: [whenRevealed(putIntoThreatArea())],
});
const onePerLocationAttachment = blankTreachery('one_per_location_attachment', {
  locationAttachment: { onePerLocation: true },
  abilities: [whenRevealed(attachToLocation())],
});
const relicCard = blankAsset('relic');

/** The hall, with alice standing in it. */
const aliceInHall = newGame()
  .withLocation(hall, hallCard)
  .withInvestigator(alice, { locationId: hall });

/** The hall, with alice at no location. */
const aliceNowhere = newGame().withLocation(hall, hallCard).withInvestigator(alice);

const draw: Command = { type: 'DrawEncounter', investigatorId: alice };

/** Instance IDs in a zone, top first. */
function idsIn(state: GameState, zone: Zone): string[] {
  return state.order[zoneKey(zone)] ?? [];
}

describe('DrawEncounter', () => {
  it('reveals the top card and discards a plain treachery on top of the discard', () => {
    const { context, state } = aliceInHall
      .withCard(instanceId('top_card'), plainTreachery, encounterDeck)
      .withCard(instanceId('second_card'), foeCard, encounterDeck)
      .withCard(instanceId('old_discard'), relicCard, encounterDiscard)
      .start();

    const { state: after, events } = execute(context, state, draw);

    expect(events.map((e) => e.type)).toEqual([
      'EncounterCardDrawn',
      'CardMoved',
      'CardFlipped',
      'CardMoved',
    ]);
    expect(after.cards[instanceId('top_card')]).toMatchObject({
      faceUp: true,
      zone: encounterDiscard,
    });
    expect(idsIn(after, encounterDiscard)).toEqual(['top_card', 'old_discard']);
    expect(idsIn(after, encounterDeck)).toEqual(['second_card']);
  });

  it('spawns an enemy at the drawing investigator`s location and engages them', () => {
    const { context, state } = aliceInHall
      .withCard(instanceId('drawn_foe'), foeCard, encounterDeck)
      .start();

    const after = stateAfter(context, state, draw);

    expect(after.cards[instanceId('drawn_foe')]?.zone).toEqual(engagedWith(alice));
  });

  it('puts a treachery that stays in play into the threat area', () => {
    const { context, state } = aliceInHall
      .withCard(instanceId('lingering_card'), lingeringTreachery, encounterDeck)
      .start();

    const after = stateAfter(context, state, draw);

    expect(after.cards[instanceId('lingering_card')]?.zone).toEqual(threatAreaOf(alice));
  });

  describe('a treachery that attaches to the location, limit 1 per location', () => {
    it('attaches to the drawing investigator`s location', () => {
      const { context, state } = aliceInHall
        .withCard(instanceId('fog_card'), onePerLocationAttachment, encounterDeck)
        .start();

      const after = stateAfter(context, state, draw);

      expect(idsIn(after, attachedTo(hall))).toEqual(['fog_card']);
    });

    it('is discarded while another copy is attached there', () => {
      const { context, state } = aliceInHall
        .withCard(instanceId('first_fog'), onePerLocationAttachment, encounterDeck)
        .withCard(instanceId('second_fog'), onePerLocationAttachment, encounterDeck)
        // Keeps the deck from running out, which would shuffle the discard back.
        .withCard(instanceId('bottom_card'), plainTreachery, encounterDeck)
        .start();

      const after = stateAfter(context, stateAfter(context, state, draw), draw);

      expect(idsIn(after, attachedTo(hall))).toEqual(['first_fog']);
      expect(idsIn(after, encounterDiscard)).toEqual(['second_fog']);
    });

    it('is discarded when the drawer is at no location', () => {
      const { context, state } = aliceNowhere
        .withCard(instanceId('fog_card'), onePerLocationAttachment, encounterDeck)
        // Keeps the deck from running out, which would shuffle the discard back.
        .withCard(instanceId('bottom_card'), plainTreachery, encounterDeck)
        .start();

      const after = stateAfter(context, state, draw);

      expect(idsIn(after, encounterDiscard)).toEqual(['fog_card']);
    });
  });

  it('discards a card that is neither enemy nor treachery', () => {
    const { context, state } = aliceInHall
      .withCard(instanceId('drawn_relic'), relicCard, encounterDeck)
      .withCard(instanceId('second_card'), plainTreachery, encounterDeck)
      .start();

    const after = stateAfter(context, state, draw);

    expect(after.cards[instanceId('drawn_relic')]?.zone).toEqual(encounterDiscard);
  });

  it('records peril on the draw', () => {
    const { context, state } = aliceInHall
      .withCard(instanceId('peril_card'), perilTreachery, encounterDeck)
      .start();

    const { events } = execute(context, state, draw);

    expect(events[0]).toMatchObject({
      type: 'EncounterCardDrawn',
      cardId: 'peril_card',
      peril: true,
      surge: false,
    });
  });

  it('draws again after a surge card', () => {
    const { context, state } = aliceInHall
      .withCard(instanceId('surge_card'), surgeTreachery, encounterDeck)
      .withCard(instanceId('after_surge'), plainTreachery, encounterDeck)
      .withCard(instanceId('untouched_foe'), foeCard, encounterDeck)
      .start();

    const { state: after, events } = execute(context, state, draw);

    const drawn = events.filter((e) => e.type === 'EncounterCardDrawn');
    expect(drawn.map((e) => e.cardId)).toEqual(['surge_card', 'after_surge']);
    expect(idsIn(after, encounterDeck)).toEqual(['untouched_foe']);
  });

  it('stops drawing when every encounter card has surge', () => {
    const { context, state } = aliceInHall
      .withCard(instanceId('first_surge'), surgeTreachery, encounterDeck)
      .withCard(instanceId('second_surge'), surgeTreachery, encounterDeck)
      .start();

    const { events } = execute(context, state, draw);

    expect(events.filter((e) => e.type === 'EncounterCardDrawn')).toHaveLength(2);
  });

  it('stops a surge when no card is left to draw', () => {
    const { context, state } = aliceInHall
      .withCard(instanceId('last_card'), surgeFoe, encounterDeck)
      .start();

    const { events } = execute(context, state, draw);

    expect(events.filter((e) => e.type === 'EncounterCardDrawn')).toHaveLength(1);
  });

  it('reshuffles the discard as soon as the last card has left the deck', () => {
    const { context, state } = aliceInHall
      .withCard(instanceId('last_deck_card'), plainTreachery, encounterDeck)
      .withCard(instanceId('discarded_foe'), foeCard, encounterDiscard)
      .start();

    const { state: after, events } = execute(context, state, draw);

    expect(events.map((e) => e.type)).toEqual([
      'EncounterCardDrawn',
      'CardMoved',
      'CardFlipped',
      'CardMoved',
      'CardMoved',
      'CardMoved',
      'DeckShuffled',
    ]);
    expect([...idsIn(after, encounterDeck)].sort()).toEqual(['discarded_foe', 'last_deck_card']);
    expect(idsIn(after, encounterDiscard)).toEqual([]);
  });

  it('reshuffles the discard when the last card of the deck is an enemy that stays in play', () => {
    const { context, state } = aliceInHall
      .withCard(instanceId('last_deck_foe'), foeCard, encounterDeck)
      .withCard(instanceId('discarded_treachery'), plainTreachery, encounterDiscard)
      .start();

    const after = stateAfter(context, state, draw);

    expect(idsIn(after, encounterDeck)).toEqual(['discarded_treachery']);
    expect(idsIn(after, encounterDiscard)).toEqual([]);
  });

  it('does not shuffle when the deck runs out with an empty discard', () => {
    const { context, state } = aliceInHall
      .withCard(instanceId('last_deck_foe'), foeCard, encounterDeck)
      .start();

    const { events } = execute(context, state, draw);

    expect(events.filter((e) => e.type === 'DeckShuffled')).toEqual([]);
  });

  it('reshuffles the discard into a deck that was already empty before drawing', () => {
    const { context, state } = aliceInHall
      .withCard(instanceId('discard_one'), plainTreachery, encounterDiscard)
      .withCard(instanceId('discard_two'), plainTreachery, encounterDiscard)
      .withCard(instanceId('discard_three'), plainTreachery, encounterDiscard)
      .start();

    const { state: after, events } = execute(context, state, draw);

    expect(events.filter((e) => e.type === 'DeckShuffled')).toHaveLength(1);
    expect(idsIn(after, encounterDeck)).toHaveLength(2);
    expect(idsIn(after, encounterDiscard)).toHaveLength(1);
  });

  describe('reshuffling with a seed', () => {
    const table = aliceInHall
      .withCard(instanceId('plain_a'), plainTreachery, encounterDiscard)
      .withCard(instanceId('foe_a'), foeCard, encounterDiscard)
      .withCard(instanceId('relic_a'), relicCard, encounterDiscard)
      .withCard(instanceId('peril_a'), perilTreachery, encounterDiscard)
      .withCard(instanceId('lingering_a'), lingeringTreachery, encounterDiscard)
      .withCard(instanceId('plain_b'), plainTreachery, encounterDiscard)
      .withCard(instanceId('foe_b'), foeCard, encounterDiscard)
      .withCard(instanceId('relic_b'), relicCard, encounterDiscard);

    it('reshuffles the same way for the same seed and differently across seeds', () => {
      const seeded = (seed: number) => {
        const { context, state } = table.withSeed(seed).start();
        return idsIn(stateAfter(context, state, draw), encounterDeck);
      };

      expect(seeded(7)).toEqual(seeded(7));
      expect(seeded(8)).not.toEqual(seeded(7));
    });
  });

  it('reshuffles a surge card that was just discarded before the surge draw', () => {
    const { context, state } = aliceInHall
      .withCard(instanceId('surge_card'), surgeTreachery, encounterDeck)
      .withCard(instanceId('discarded_treachery'), plainTreachery, encounterDiscard)
      .start();

    const { state: after, events } = execute(context, state, draw);

    const types = events.map((e) => e.type);
    const shuffled = events.find((e) => e.type === 'DeckShuffled');
    expect(types.indexOf('DeckShuffled')).toBeLessThan(types.lastIndexOf('EncounterCardDrawn'));
    expect(shuffled?.type === 'DeckShuffled' && [...shuffled.order].sort()).toEqual([
      'discarded_treachery',
      'surge_card',
    ]);
    expect(events.filter((e) => e.type === 'EncounterCardDrawn')).toHaveLength(2);
    expect(checkInvariants(after)).toEqual([]);
  });

  it('rejects a draw when the deck and the discard are empty', () => {
    const { context, state } = aliceInHall.start();

    expect(rejectionFrom(context, state, draw)).toEqual({ code: 'encounterDeckEmpty' });
  });

  it('rejects an enemy draw for an investigator without a location', () => {
    const { context, state } = aliceNowhere
      .withCard(instanceId('drawn_foe'), foeCard, encounterDeck)
      .start();

    expect(rejectionFrom(context, state, draw)).toEqual({
      code: 'investigatorHasNoLocation',
      investigatorId: alice,
    });
  });

  it('rejects a draw for an unknown investigator', () => {
    const { context, state } = aliceInHall
      .withCard(instanceId('top_card'), plainTreachery, encounterDeck)
      .start();
    const command: Command = { type: 'DrawEncounter', investigatorId: investigatorId('nobody') };

    expect(rejectionFrom(context, state, command).code).toBe('unknownInvestigator');
  });
});

describe('DrawEncounter with a match', () => {
  const ghoulFoe = blankEnemy('ghoul_foe', { name: 'Ghoul Minion', traits: [trait('Ghoul')] });
  const otherFoe = blankEnemy('other_foe', { name: 'Other Foe', traits: [trait('Monster')] });
  const ghoulTreachery = blankTreachery('ghoul_treachery', { traits: [trait('Ghoul')] });
  const surgeGhoulFoe = blankEnemy('surge_ghoul_foe', {
    traits: [trait('Ghoul')],
    keywords: [{ name: 'surge' }],
  });
  const drawGhoulEnemy: Command = {
    type: 'DrawEncounter',
    investigatorId: alice,
    match: { trait: trait('Ghoul'), typeCode: 'enemy' },
  };

  it('takes the first matching card of the deck and leaves the cards above it', () => {
    const { context, state } = aliceInHall
      .withCard(instanceId('top_card'), plainTreachery, encounterDeck)
      .withCard(instanceId('first_ghoul'), ghoulFoe, encounterDeck)
      .withCard(instanceId('second_ghoul'), ghoulFoe, encounterDeck)
      .start();

    const after = stateAfter(context, state, drawGhoulEnemy);

    expect(after.cards[instanceId('first_ghoul')]).toMatchObject({
      faceUp: true,
      zone: engagedWith(alice),
    });
    expect(idsIn(after, encounterDeck)).toEqual(['top_card', 'second_ghoul']);
  });

  it('discards the cards above the match first when asked to', () => {
    const { context, state } = aliceInHall
      .withCard(instanceId('skipped_treachery'), plainTreachery, encounterDeck)
      .withCard(instanceId('skipped_foe'), otherFoe, encounterDeck)
      .withCard(instanceId('drawn_ghoul'), ghoulFoe, encounterDeck)
      .withCard(instanceId('below_ghoul'), plainTreachery, encounterDeck)
      .withCard(instanceId('old_discard'), plainTreachery, encounterDiscard)
      .start();

    const after = stateAfter(context, state, { ...drawGhoulEnemy, discardSkipped: true });

    expect(idsIn(after, encounterDiscard)).toEqual([
      'skipped_foe',
      'skipped_treachery',
      'old_discard',
    ]);
    expect(idsIn(after, encounterDeck)).toEqual(['below_ghoul']);
    expect(after.cards[instanceId('drawn_ghoul')]?.zone).toEqual(engagedWith(alice));
  });

  it('takes the topmost matching card from the discard when drawing from the discard', () => {
    const { context, state } = aliceInHall
      .withCard(instanceId('ghoul_in_deck'), ghoulFoe, encounterDeck)
      .withCard(instanceId('deck_filler'), plainTreachery, encounterDeck)
      .withCard(instanceId('discarded_treachery'), plainTreachery, encounterDiscard)
      .withCard(instanceId('upper_discarded_ghoul'), ghoulFoe, encounterDiscard)
      .withCard(instanceId('lower_discarded_ghoul'), ghoulFoe, encounterDiscard)
      .start();

    const after = stateAfter(context, state, { ...drawGhoulEnemy, from: 'discard' });

    expect(after.cards[instanceId('upper_discarded_ghoul')]?.zone).toEqual(engagedWith(alice));
    expect(idsIn(after, encounterDiscard)).toEqual([
      'discarded_treachery',
      'lower_discarded_ghoul',
    ]);
    expect(idsIn(after, encounterDeck)).toEqual(['ghoul_in_deck', 'deck_filler']);
  });

  it('searches the deck before the discard when drawing from either', () => {
    const { context, state } = aliceInHall
      .withCard(instanceId('ghoul_in_deck'), ghoulFoe, encounterDeck)
      .withCard(instanceId('deck_filler'), plainTreachery, encounterDeck)
      .withCard(instanceId('ghoul_in_discard'), ghoulFoe, encounterDiscard)
      .start();

    const after = stateAfter(context, state, { ...drawGhoulEnemy, from: 'deckOrDiscard' });

    expect(after.cards[instanceId('ghoul_in_deck')]?.zone).toEqual(engagedWith(alice));
    expect(after.cards[instanceId('ghoul_in_discard')]?.zone).toEqual(encounterDiscard);
  });

  it('finds a card that is only in the discard when drawing from either', () => {
    const { context, state } = aliceInHall
      .withCard(instanceId('deck_filler'), plainTreachery, encounterDeck)
      .withCard(instanceId('second_filler'), plainTreachery, encounterDeck)
      .withCard(instanceId('ghoul_in_discard'), ghoulFoe, encounterDiscard)
      .start();

    const after = stateAfter(context, state, { ...drawGhoulEnemy, from: 'deckOrDiscard' });

    expect(after.cards[instanceId('ghoul_in_discard')]?.zone).toEqual(engagedWith(alice));
  });

  it('matches by name', () => {
    const { context, state } = aliceInHall
      .withCard(instanceId('ghoul_minion'), ghoulFoe, encounterDeck)
      .withCard(instanceId('other_foe_card'), otherFoe, encounterDeck)
      .start();

    const after = stateAfter(context, state, {
      type: 'DrawEncounter',
      investigatorId: alice,
      match: { name: 'Other Foe' },
    });

    expect(after.cards[instanceId('other_foe_card')]?.zone).toEqual(engagedWith(alice));
    expect(idsIn(after, encounterDeck)).toEqual(['ghoul_minion']);
  });

  it('draws nothing when no card matches every given field', () => {
    const { context, state } = aliceInHall
      .withCard(instanceId('ghoul_treachery_card'), ghoulTreachery, encounterDeck)
      .start();

    const { events } = execute(context, state, drawGhoulEnemy);

    expect(events).toEqual([]);
  });

  it('does not look in the discard unless told to', () => {
    const { context, state } = aliceInHall
      .withCard(instanceId('ghoul_in_discard'), ghoulFoe, encounterDiscard)
      .start();

    const after = stateAfter(context, state, drawGhoulEnemy);

    expect(idsIn(after, encounterDiscard)).toEqual(['ghoul_in_discard']);
  });

  it('discards nothing when no card matches, even when asked to discard the cards above', () => {
    const { context, state } = aliceInHall
      .withCard(instanceId('top_card'), plainTreachery, encounterDeck)
      .start();

    const after = stateAfter(context, state, { ...drawGhoulEnemy, discardSkipped: true });

    expect(idsIn(after, encounterDeck)).toEqual(['top_card']);
  });

  it('draws again from the top after a matched card with surge', () => {
    const { context, state } = aliceInHall
      .withCard(instanceId('top_card'), plainTreachery, encounterDeck)
      .withCard(instanceId('surging_ghoul'), surgeGhoulFoe, encounterDeck)
      .withCard(instanceId('old_discard'), plainTreachery, encounterDiscard)
      .start();

    const { state: after, events } = execute(context, state, drawGhoulEnemy);

    const drawn = events.filter((e) => e.type === 'EncounterCardDrawn');
    expect(drawn.map((e) => e.cardId)).toEqual(['surging_ghoul', 'top_card']);
    expect(after.cards[instanceId('surging_ghoul')]?.zone).toEqual(engagedWith(alice));
  });

  it('reshuffles the discard when the matched card was the last one in the deck', () => {
    const { context, state } = aliceInHall
      .withCard(instanceId('last_deck_ghoul'), ghoulFoe, encounterDeck)
      .withCard(instanceId('discarded_treachery'), plainTreachery, encounterDiscard)
      .start();

    const after = stateAfter(context, state, drawGhoulEnemy);

    expect(idsIn(after, encounterDeck)).toEqual(['discarded_treachery']);
    expect(idsIn(after, encounterDiscard)).toEqual([]);
  });
});

describe('FromSetAside', () => {
  it('moves one copy per listed code, taking two copies for a code listed twice', () => {
    const { context, state } = aliceInHall
      .withCard(instanceId('first_foe'), foeCard, setAside)
      .withCard(instanceId('set_aside_treachery'), plainTreachery, setAside)
      .withCard(instanceId('second_foe'), foeCard, setAside)
      .start();

    const after = stateAfter(context, state, {
      type: 'FromSetAside',
      codes: [foeCard.code, foeCard.code],
      to: { kind: 'victoryDisplay' },
    });

    expect(idsIn(after, { kind: 'victoryDisplay' })).toEqual(['first_foe', 'second_foe']);
    expect(idsIn(after, setAside)).toEqual(['set_aside_treachery']);
  });

  it('rejects a code with no set-aside copy left', () => {
    const { context, state } = aliceInHall
      .withCard(instanceId('only_foe'), foeCard, setAside)
      .start();

    expect(
      rejectionFrom(context, state, {
        type: 'FromSetAside',
        codes: [foeCard.code, foeCard.code],
        to: { kind: 'outOfGame' },
      }),
    ).toEqual({ code: 'cardNotInZone', zone: 'setAside', match: 'foe' });
  });
});

describe('ShuffleInto', () => {
  it('adds the set-aside cards to the deck and shuffles all of it', () => {
    const { context, state } = aliceInHall
      .withCard(instanceId('deck_card_a'), plainTreachery, encounterDeck)
      .withCard(instanceId('deck_card_b'), plainTreachery, encounterDeck)
      .withCard(instanceId('deck_card_c'), plainTreachery, encounterDeck)
      .withCard(instanceId('set_aside_foe'), foeCard, setAside)
      .withCard(instanceId('set_aside_relic'), relicCard, setAside)
      .start();

    const { state: after, events } = execute(context, state, {
      type: 'ShuffleInto',
      codes: [foeCard.code, relicCard.code],
      zone: encounterDeck,
    });

    expect(events.at(-1)?.type).toBe('DeckShuffled');
    expect([...idsIn(after, encounterDeck)].sort()).toEqual([
      'deck_card_a',
      'deck_card_b',
      'deck_card_c',
      'set_aside_foe',
      'set_aside_relic',
    ]);
    expect(idsIn(after, setAside)).toEqual([]);
  });

  it('rejects a code that is not set aside', () => {
    const { context, state } = aliceInHall
      .withCard(instanceId('deck_foe'), foeCard, encounterDeck)
      .start();

    expect(
      rejectionFrom(context, state, {
        type: 'ShuffleInto',
        codes: [foeCard.code],
        zone: encounterDeck,
      }).code,
    ).toBe('cardNotInZone');
  });
});

describe('ShuffleEncounterDiscard', () => {
  const shuffleDiscard: Command = { type: 'ShuffleEncounterDiscard' };

  it('moves the whole discard into the deck and shuffles all of it', () => {
    const { context, state } = aliceInHall
      .withCard(instanceId('deck_card'), plainTreachery, encounterDeck)
      .withCard(instanceId('discarded_foe'), foeCard, encounterDiscard)
      .withCard(instanceId('discarded_treachery'), plainTreachery, encounterDiscard)
      .start();

    const { state: after, events } = execute(context, state, shuffleDiscard);

    expect(events.at(-1)?.type).toBe('DeckShuffled');
    expect([...idsIn(after, encounterDeck)].sort()).toEqual([
      'deck_card',
      'discarded_foe',
      'discarded_treachery',
    ]);
    expect(idsIn(after, encounterDiscard)).toEqual([]);
  });

  it('leaves the deck in its order when the discard is empty', () => {
    const { context, state } = aliceInHall
      .withCard(instanceId('deck_card_a'), plainTreachery, encounterDeck)
      .withCard(instanceId('deck_card_b'), foeCard, encounterDeck)
      .start();

    const { events } = execute(context, state, shuffleDiscard);

    expect(events).toEqual([]);
  });
});

describe('ShuffleEncounterDeck', () => {
  const shuffleDeck: Command = { type: 'ShuffleEncounterDeck' };

  it('shuffles the deck and leaves the discard alone', () => {
    const { context, state } = aliceInHall
      .withCard(instanceId('deck_card_a'), plainTreachery, encounterDeck)
      .withCard(instanceId('deck_card_b'), foeCard, encounterDeck)
      .withCard(instanceId('discarded_treachery'), plainTreachery, encounterDiscard)
      .start();

    const { state: after, events } = execute(context, state, shuffleDeck);

    expect(events.map((event) => event.type)).toEqual(['DeckShuffled']);
    expect([...idsIn(after, encounterDeck)].sort()).toEqual(['deck_card_a', 'deck_card_b']);
    expect(idsIn(after, encounterDiscard)).toEqual(['discarded_treachery']);
  });

  it('does nothing to an empty deck', () => {
    const { context, state } = aliceInHall
      .withCard(instanceId('discarded_treachery'), plainTreachery, encounterDiscard)
      .start();

    expect(execute(context, state, shuffleDeck).events).toEqual([]);
  });
});

describe('encounter deck invariants', () => {
  const shuffleIn = (shuffled: CardStats): Command => ({
    type: 'ShuffleInto',
    codes: [shuffled.code],
    zone: encounterDeck,
  });

  it.each([
    {
      name: 'plain draws',
      table: aliceInHall
        .withCard(instanceId('plain_card'), plainTreachery, encounterDeck)
        .withCard(instanceId('foe_card'), foeCard, encounterDeck)
        .withCard(instanceId('lingering_card'), lingeringTreachery, encounterDeck),
      steps: [draw, draw, draw],
    },
    {
      name: 'draws through a reshuffle',
      table: aliceInHall
        .withCard(instanceId('last_deck_card'), plainTreachery, encounterDeck)
        .withCard(instanceId('discarded_foe'), foeCard, encounterDiscard)
        .withCard(instanceId('discarded_relic'), relicCard, encounterDiscard)
        .withCard(instanceId('discarded_peril'), perilTreachery, encounterDiscard),
      steps: [draw, draw, draw, draw, draw],
    },
    {
      name: 'a surge chain',
      table: aliceInHall
        .withCard(instanceId('surge_treachery_card'), surgeTreachery, encounterDeck)
        .withCard(instanceId('surge_foe_card'), surgeFoe, encounterDeck)
        .withCard(instanceId('plain_card'), plainTreachery, encounterDeck)
        .withCard(instanceId('discarded_foe'), foeCard, encounterDiscard),
      steps: [draw, draw],
    },
    {
      name: 'only surge cards',
      table: aliceInHall
        .withCard(instanceId('surge_treachery_card'), surgeTreachery, encounterDeck)
        .withCard(instanceId('other_surge'), surgeTreachery, encounterDeck)
        .withCard(instanceId('discarded_surge_foe'), surgeFoe, encounterDiscard),
      steps: [draw, draw],
    },
    {
      name: 'cards shuffled in between draws',
      table: aliceInHall
        .withCard(instanceId('plain_card'), plainTreachery, encounterDeck)
        .withCard(instanceId('set_aside_foe'), foeCard, setAside)
        .withCard(instanceId('set_aside_lingering'), lingeringTreachery, setAside),
      steps: [draw, shuffleIn(foeCard), draw, shuffleIn(lingeringTreachery), draw, draw],
    },
    { name: 'a draw from nothing', table: aliceInHall, steps: [draw] },
  ])(
    'keeps every card in exactly one zone and the card count constant: $name',
    ({ table, steps }) => {
      const { context, state: started } = table.start();
      let state = started;
      const cardCount = Object.keys(state.cards).length;

      for (const step of steps) {
        try {
          state = stateAfter(context, state, step);
        } catch (error) {
          // A rejected step leaves the state unchanged, which the checks below still cover.
          if (!(error instanceof CommandRejected)) throw error;
        }

        const placed = Object.values(state.order).reduce((sum, ids) => sum + ids.length, 0);
        expect(checkInvariants(state)).toEqual([]);
        expect(Object.keys(state.cards)).toHaveLength(cardCount);
        expect(placed).toBe(cardCount);
      }
    },
  );

  it.each([
    {
      name: 'one plain card in the deck, a foe in the discard',
      table: aliceInHall
        .withCard(instanceId('deck_card'), plainTreachery, encounterDeck)
        .withCard(instanceId('discarded_foe'), foeCard, encounterDiscard),
    },
    {
      name: 'a foe in the deck, two plain cards in the discard',
      table: aliceInHall
        .withCard(instanceId('deck_foe'), foeCard, encounterDeck)
        .withCard(instanceId('discard_a'), plainTreachery, encounterDiscard)
        .withCard(instanceId('discard_b'), plainTreachery, encounterDiscard),
    },
    {
      name: 'a lingering treachery in the deck, a relic in the discard',
      table: aliceInHall
        .withCard(instanceId('deck_lingering'), lingeringTreachery, encounterDeck)
        .withCard(instanceId('discarded_relic'), relicCard, encounterDiscard),
    },
    {
      name: 'an empty deck, three cards in the discard',
      table: aliceInHall
        .withCard(instanceId('discarded_treachery'), plainTreachery, encounterDiscard)
        .withCard(instanceId('discarded_foe'), foeCard, encounterDiscard)
        .withCard(instanceId('discarded_relic'), relicCard, encounterDiscard),
    },
    {
      name: 'a surge card in the deck, a peril card in the discard',
      table: aliceInHall
        .withCard(instanceId('deck_surge'), surgeTreachery, encounterDeck)
        .withCard(instanceId('discarded_peril'), perilTreachery, encounterDiscard),
    },
    {
      name: 'two plain cards in the deck, an empty discard',
      table: aliceInHall
        .withCard(instanceId('deck_a'), plainTreachery, encounterDeck)
        .withCard(instanceId('deck_b'), plainTreachery, encounterDeck),
    },
  ])('never leaves the deck empty while the discard has cards: $name', ({ table }) => {
    for (const seed of [1, 2, 3]) {
      const { context, state } = table.withSeed(seed).start();
      const after = stateAfter(context, state, draw);

      const deckSize = idsIn(after, encounterDeck).length;
      const discardSize = idsIn(after, encounterDiscard).length;
      expect(deckSize === 0 && discardSize > 0).toBe(false);
    }
  });
});

describe('surge after the drawn card has resolved', () => {
  const aliceDrawsAgain: Command = { type: 'DrawEncounter', investigatorId: alice };

  /**
   * The plain treachery above plus four surge cards: `burning_surge`, whose
   * revelation deals the drawer 1 damage; `testing_surge`, which asks for a
   * willpower (3) test; `deadly_surge`, whose revelation deals the drawer 8
   * damage (alice's whole health); and `choosy_foe`, an enemy whose spawn
   * text the engine cannot read, so the players choose its location.
   */
  const burningSurge = blankTreachery('burning_surge', {
    keywords: [{ name: 'surge' }],
    abilities: [whenRevealed(takeDamage(1))],
  });
  const testingSurge = blankTreachery('testing_surge', {
    keywords: [{ name: 'surge' }],
    abilities: [whenRevealed(skillTest('willpower', 3))],
  });
  const deadlySurge = blankTreachery('deadly_surge', {
    keywords: [{ name: 'surge' }],
    abilities: [whenRevealed(takeDamage(8))],
  });
  const choosyFoe = blankEnemy('choosy_foe', {
    keywords: [{ name: 'surge' }, { name: 'spawn', detail: 'the location with the most clues' }],
  });

  /**
   * What happened, in order, as far as these tests look: draws, damage,
   * drawn cards discarded after resolving, engagements, dropped draws.
   */
  function resolutionOrder(events: readonly Event[]): string[] {
    return events.flatMap((e) => {
      switch (e.type) {
        case 'EncounterCardDrawn':
          return [`draws ${e.cardId}`];
        case 'InvestigatorChanged':
          return [`alice ${e.stat} +${e.delta}`];
        case 'CardMoved':
          return e.from.kind === 'resolving' && e.to.kind === 'encounterDiscard'
            ? [`discards ${e.cardId}`]
            : [];
        case 'EnemyEngaged':
          return [`${e.enemyId} engages ${e.investigatorId}`];
        case 'ActionDropped':
          return [`drops ${e.command.type} (${e.reason.code})`];
        default:
          return [];
      }
    });
  }

  it('resolves the revealed card`s effect before the surge draw', () => {
    const { context, state } = aliceInHall
      .withCard(instanceId('burning_card'), burningSurge, encounterDeck)
      .withCard(instanceId('after_surge'), plainTreachery, encounterDeck)
      .start();

    const { events } = execute(context, state, draw);

    expect(resolutionOrder(events)).toEqual([
      'draws burning_card',
      'alice damage +1',
      'discards burning_card',
      'draws after_surge',
      'discards after_surge',
    ]);
  });

  it('holds the surge draw while the card`s revelation test waits for its result', () => {
    const { context, state } = aliceInHall
      .withCard(instanceId('testing_card'), testingSurge, encounterDeck)
      .withCard(instanceId('after_surge'), plainTreachery, encounterDeck)
      .start();

    const asked = stateAfter(context, state, draw);

    expect(asked.pending.map((decision) => decision.id)).toEqual(['test:testing_card']);
    expect(asked.meta.queue).toEqual([
      { kind: 'placeDrawnCard', drawn: expect.objectContaining({ cardId: 'testing_card' }) },
      { kind: 'surge', draw: aliceDrawsAgain },
    ]);
    expect(idsIn(asked, encounterDeck)).toEqual(['after_surge']);
  });

  it('draws the surge card once the test is answered and the card discarded', () => {
    const { context, state } = aliceInHall
      .withCard(instanceId('testing_card'), testingSurge, encounterDeck)
      .withCard(instanceId('after_surge'), plainTreachery, encounterDeck)
      .start();
    const asked = stateAfter(context, state, draw);

    const { state: answered, events } = execute(
      context,
      asked,
      answer('test:testing_card', 'fail'),
    );

    expect(resolutionOrder(events)).toEqual([
      'discards testing_card',
      'draws after_surge',
      'discards after_surge',
    ]);
    expect(answered.meta.queue).toBeUndefined();
  });

  it('draws nothing more when the surging card was the last one', () => {
    const { context, state } = aliceInHall
      .withCard(instanceId('testing_card'), testingSurge, encounterDeck)
      .start();

    const asked = stateAfter(context, state, draw);

    const { state: answered, events } = execute(
      context,
      asked,
      answer('test:testing_card', 'fail'),
    );

    expect(resolutionOrder(events)).toEqual(['discards testing_card']);
    expect(answered.meta.queue).toBeUndefined();
  });

  it('places the card, but draws nothing more once its revelation defeated alice', () => {
    const { context, state } = aliceInHall
      .withCard(instanceId('deadly_card'), deadlySurge, encounterDeck)
      .withCard(instanceId('after_surge'), plainTreachery, encounterDeck)
      .start();

    const { events } = execute(context, state, draw);

    expect(resolutionOrder(events)).toEqual([
      'draws deadly_card',
      'alice damage +8',
      'discards deadly_card',
    ]);
  });

  it('draws the surge card only after the players chose where the enemy spawns', () => {
    const { context, state } = aliceInHall
      .withCard(instanceId('choosy_card'), choosyFoe, encounterDeck)
      .withCard(instanceId('after_surge'), plainTreachery, encounterDeck)
      .start();
    const asked = stateAfter(context, state, draw);

    const { events } = execute(context, asked, answer('spawn:choosy_card', hall));

    expect(asked.meta.queue).toEqual([{ kind: 'surge', draw: aliceDrawsAgain }]);
    expect(resolutionOrder(events)).toEqual([
      'choosy_card engages alice',
      'draws after_surge',
      'discards after_surge',
    ]);
  });
});

describe('revelation before the drawn card is placed', () => {
  /**
   * Every card here has a revelation ability. `scorching_*` cards deal the
   * drawer 1 damage; `lethal_*` cards deal 8 (alice's whole health);
   * `vanishing_treachery` removes itself from the game. `lethal_hall_foe`
   * spawns at the Hall.
   */
  const scorchingTreachery = blankTreachery('scorching_treachery', {
    abilities: [whenRevealed(takeDamage(1))],
  });
  const scorchingFoe = blankEnemy('scorching_foe', { abilities: [whenRevealed(takeDamage(1))] });
  const scorchingLingering = blankTreachery('scorching_lingering', {
    abilities: [whenRevealed(takeDamage(1), putIntoThreatArea())],
  });
  const scorchingAttachment = blankTreachery('scorching_attachment', {
    locationAttachment: { onePerLocation: true },
    abilities: [whenRevealed(takeDamage(1), attachToLocation())],
  });
  const lethalTreachery = blankTreachery('lethal_treachery', {
    abilities: [whenRevealed(takeDamage(8))],
  });
  const lethalFoe = blankEnemy('lethal_foe', { abilities: [whenRevealed(takeDamage(8))] });
  const lethalHallFoe = blankEnemy('lethal_hall_foe', {
    keywords: [{ name: 'spawn', detail: 'hall' }],
    abilities: [whenRevealed(takeDamage(8))],
  });
  const vanishingTreachery = blankTreachery('vanishing_treachery', {
    abilities: [whenRevealed(moveSelf({ kind: 'outOfGame' }))],
  });

  /** What happened, in order: draws, damage, and where the drawn card went. */
  function resolutionOrder(events: readonly Event[]): string[] {
    return events.flatMap((e) => {
      switch (e.type) {
        case 'EncounterCardDrawn':
          return [`draws ${e.cardId}`];
        case 'InvestigatorChanged':
          return [`alice ${e.stat} +${e.delta}`];
        case 'CardMoved':
          return e.from.kind === 'resolving' ? [`${e.cardId} to ${e.to.kind}`] : [];
        default:
          return [];
      }
    });
  }

  it('discards a card whose revelation defeated alice before putting it into her threat area', () => {
    const lethalLingering = blankTreachery('lethal_lingering', {
      abilities: [whenRevealed(takeDamage(8), putIntoThreatArea())],
    });
    const { context, state } = aliceInHall
      .withCard(instanceId('drawn_card'), lethalLingering, encounterDeck)
      .start();

    const { events } = execute(context, state, draw);

    expect(resolutionOrder(events)).toEqual([
      'draws drawn_card',
      'alice damage +8',
      'drawn_card to encounterDiscard',
    ]);
  });

  it('drops a test that follows the damage which defeated alice, instead of rejecting the draw', () => {
    const lethalTesting = blankTreachery('lethal_testing', {
      abilities: [whenRevealed(takeDamage(8), skillTest('willpower', 3))],
    });
    const { context, state } = aliceInHall
      .withCard(instanceId('drawn_card'), lethalTesting, encounterDeck)
      .start();

    const { state: after, events } = execute(context, state, draw);

    expect(after.pending).toEqual([]);
    expect(resolutionOrder(events)).toEqual([
      'draws drawn_card',
      'alice damage +8',
      'drawn_card to encounterDiscard',
    ]);
  });

  it('resolves the effects after a revelation test once it is answered', () => {
    const testingScorcher = blankTreachery('testing_scorcher', {
      abilities: [whenRevealed(skillTest('willpower', 3), takeDamage(1))],
    });
    const { context, state } = aliceInHall
      .withCard(instanceId('drawn_card'), testingScorcher, encounterDeck)
      .start();
    const asked = stateAfter(context, state, draw);

    const { events } = execute(context, asked, answer('test:drawn_card', 'pass'));

    expect(asked.meta.queue?.map((step) => step.kind)).toEqual(['ability', 'placeDrawnCard']);
    expect(resolutionOrder(events)).toEqual(['alice damage +1', 'drawn_card to encounterDiscard']);
  });

  it.each([
    { drawn: scorchingTreachery, placed: 'drawn_card to encounterDiscard' },
    { drawn: scorchingFoe, placed: 'drawn_card to atLocation' },
    { drawn: scorchingLingering, placed: 'drawn_card to threatArea' },
    { drawn: scorchingAttachment, placed: 'drawn_card to attachedTo' },
  ])('resolves the revelation of $drawn.code before placing it', ({ drawn, placed }) => {
    const { context, state } = aliceInHall
      .withCard(instanceId('drawn_card'), drawn, encounterDeck)
      .withCard(instanceId('next_card'), scorchingTreachery, encounterDeck)
      .start();

    const { events } = execute(context, state, draw);

    expect(resolutionOrder(events)).toEqual(['draws drawn_card', 'alice damage +1', placed]);
  });

  it('keeps the card in the resolving zone while its revelation resolves', () => {
    const { context, state } = aliceInHall
      .withCard(instanceId('drawn_foe'), scorchingFoe, encounterDeck)
      .start();

    const { events } = execute(context, state, draw);

    const revelationAt = events.findIndex((e) => e.type === 'InvestigatorChanged');
    const beforeRevelation = replay(events.slice(0, revelationAt), state);
    expect(beforeRevelation.cards[instanceId('drawn_foe')]?.zone).toEqual({ kind: 'resolving' });
  });

  it('resolves a reference nested in a zone: the revelation puts the card in the drawer`s threat area', () => {
    const clingingTreachery = blankTreachery('clinging_treachery', {
      abilities: [
        whenRevealed(
          moveSelf({ kind: 'threatArea', investigatorId: { ref: 'windowInvestigator' } }),
        ),
      ],
    });
    const { context, state } = aliceInHall
      .withCard(instanceId('clinging_card'), clingingTreachery, encounterDeck)
      .start();

    const after = stateAfter(context, state, draw);

    expect(after.cards[instanceId('clinging_card')]?.zone).toEqual(threatAreaOf(alice));
  });

  it('does not place a card its revelation has already moved', () => {
    const { context, state } = aliceInHall
      .withCard(instanceId('vanishing_card'), vanishingTreachery, encounterDeck)
      .start();

    const after = stateAfter(context, state, draw);

    expect(after.cards[instanceId('vanishing_card')]?.zone).toEqual({ kind: 'outOfGame' });
  });

  it.each([
    { drawn: lethalTreachery, placed: 'lethal_card to encounterDiscard' },
    { drawn: lethalFoe, placed: 'lethal_card to encounterDiscard' },
    { drawn: lethalHallFoe, placed: 'lethal_card to atLocation' },
  ])('places $drawn.code without the drawer it defeated: $placed', ({ drawn, placed }) => {
    const { context, state } = aliceInHall
      .withCard(instanceId('lethal_card'), drawn, encounterDeck)
      .withCard(instanceId('next_foe'), scorchingFoe, encounterDeck)
      .start();

    const { events } = execute(context, state, draw);

    expect(resolutionOrder(events)).toEqual(['draws lethal_card', 'alice damage +8', placed]);
  });
});

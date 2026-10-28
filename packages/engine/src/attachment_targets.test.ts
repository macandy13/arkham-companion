import { describe, expect, it } from 'vitest';
import {
  attachedTo,
  attachTo,
  blankLocation,
  blankTreachery,
  encounterDeck,
  encounterDiscard,
  gainSurge,
  ifNoCandidate,
  instanceId,
  investigatorId,
  locationWithMost,
  newGame,
  whenRevealed,
  type Command,
} from './index';
import { answer, stateAfter } from '../test/utils';

const alice = investigatorId('alice');
const bob = investigatorId('bob');
const hall = instanceId('hall');
const study = instanceId('study');
const door = instanceId('door');
const nextCard = instanceId('next_card');

/**
 * "Attach to the location with the most clues and without a copy of Locked Door attached. If
 * there is no such location, Locked Door gains surge."
 */
const lockingDoor = blankTreachery('locking_door', {
  locationAttachment: { onePerLocation: true },
  abilities: [
    whenRevealed(attachTo(locationWithMost('clue'))),
    ifNoCandidate(locationWithMost('clue'), whenRevealed(gainSurge())),
  ],
});
const plainTreachery = blankTreachery('plain_treachery');

const aliceDraws: Command = { type: 'DrawEncounter', investigatorId: alice };

/**
 * Alice (the lead) and bob in the hall with `hallClues`, the study with `studyClues` (revealed
 * unless `studyRevealed` is false); the door
 * is on top of the encounter deck, then a plain treachery and another one, so the deck isn't
 * reshuffled once it has drawn both.
 */
const doorDrawnWith = ({
  hallClues,
  studyClues,
  studyRevealed = true,
}: {
  hallClues: number;
  studyClues: number;
  studyRevealed?: boolean;
}) =>
  newGame()
    .withLocation(hall, blankLocation('hall'), { revealed: true, clues: hallClues })
    .withLocation(study, blankLocation('study'), { revealed: studyRevealed, clues: studyClues })
    .withConnection(hall, study)
    .withInvestigator(alice, { locationId: hall })
    .withInvestigator(bob, { locationId: hall })
    .withCard(door, lockingDoor, encounterDeck)
    .withCard(nextCard, plainTreachery, encounterDeck)
    .withCard(instanceId('bottom_card'), plainTreachery, encounterDeck);

describe('a treachery that attaches to the location with the most clues (Locked Door)', () => {
  it('attaches to the study with 3 clues, not to the hall alice drew it in', () => {
    const { context, state } = doorDrawnWith({ hallClues: 1, studyClues: 3 }).start();

    const after = stateAfter(context, state, aliceDraws);

    expect(after.cards[door]?.zone).toEqual(attachedTo(study));
    expect(after.cards[nextCard]?.zone).toEqual(encounterDeck);
  });

  it('attaches to the hall when the study already has a copy', () => {
    const { context, state } = doorDrawnWith({ hallClues: 1, studyClues: 3 })
      .withCard(instanceId('old_door'), lockingDoor, attachedTo(study))
      .start();

    const after = stateAfter(context, state, aliceDraws);

    expect(after.cards[door]?.zone).toEqual(attachedTo(hall));
  });

  it.each([
    { study: 'revealed', hallClues: 2, studyClues: 2, studyRevealed: true },
    { study: 'unrevealed', hallClues: 0, studyClues: 0, studyRevealed: false },
  ])(
    'asks alice, the lead, between the hall with $hallClues clues and the $study study with $studyClues',
    ({ hallClues, studyClues, studyRevealed }) => {
      const { context, state } = doorDrawnWith({ hallClues, studyClues, studyRevealed }).start();

      const asked = stateAfter(context, state, aliceDraws);

      expect(asked.pending).toMatchObject([
        {
          id: 'most:door',
          kind: 'chooseLocation',
          prompt: 'decision.chooseLocationToAttach',
          decider: { kind: 'lead' },
          options: [{ id: hall }, { id: study }],
        },
      ]);
      const after = stateAfter(context, asked, answer('most:door', study));
      expect(after.cards[door]?.zone).toEqual(attachedTo(study));
    },
  );

  it('is discarded and surges when both locations have a copy', () => {
    const { context, state } = doorDrawnWith({ hallClues: 1, studyClues: 3 })
      .withCard(instanceId('hall_door'), lockingDoor, attachedTo(hall))
      .withCard(instanceId('study_door'), lockingDoor, attachedTo(study))
      .start();

    const after = stateAfter(context, state, aliceDraws);

    expect(after.cards[door]?.zone).toEqual(encounterDiscard);
    expect(after.cards[nextCard]?.zone).toEqual(encounterDiscard);
  });
});

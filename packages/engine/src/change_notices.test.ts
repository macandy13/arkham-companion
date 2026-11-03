import { describe, expect, it } from 'vitest';
import {
  blankAgenda,
  blankLocation,
  blankTreachery,
  changeNotices,
  execute,
  fixed,
  instanceId,
  investigatorId,
  newGame,
  placeDoomOnAgenda,
  takeHorror,
  whenRevealed,
  type Command,
} from './index';
import { stateAfter } from '../test/utils';

const agenda = instanceId('agenda');
const hall = instanceId('hall');
const cellar = instanceId('cellar');
const rottingTreachery = instanceId('rotting_treachery');
const alice = investigatorId('alice');

/**
 * Alice in the revealed hall, next to the unrevealed cellar, whose revealed ability places 1 doom
 * on the agenda; the encounter deck holds one treachery that deals 1 horror when it is drawn.
 */
const table = newGame()
  .withAgenda(agenda, blankAgenda('agenda', fixed(9)))
  .withLocation(hall, blankLocation('hall'), { revealed: true })
  .withLocation(
    cellar,
    blankLocation('dooming_cellar', { abilities: [whenRevealed(placeDoomOnAgenda(1))] }),
  )
  .withConnection(hall, cellar)
  .withCard(
    rottingTreachery,
    blankTreachery('rotting_treachery', { abilities: [whenRevealed(takeHorror(1))] }),
    { kind: 'encounterDeck' },
  )
  .withInvestigator(alice, { locationId: hall });

const next: Command = { type: 'NextPhase' };
/** Round 1 from setup to the upkeep phase, so the next `NextPhase` runs the mythos phase of round 2. */
const toUpkeep: Command[] = [
  next,
  { type: 'StartTurn', investigatorId: alice },
  { type: 'EndTurn', investigatorId: alice },
  next,
  next,
];

describe('changeNotices', () => {
  it.each<{ name: string; command: Command; notices: unknown[] }>([
    {
      name: "alice's move into the cellar: the cellar's revealed doom, not the move itself",
      command: { type: 'MoveInvestigator', investigatorId: alice, to: cellar },
      notices: [
        {
          kind: 'tokens',
          cause: { kind: 'card', cardId: cellar, window: { kind: 'revealed' } },
          events: ['TokensChanged'],
        },
      ],
    },
    {
      name: 'the mythos phase: its doom and draw, then the drawn treachery’s horror',
      command: next,
      notices: [
        { kind: 'tokens', cause: { kind: 'rule', step: 'placeDoom' }, events: ['TokensChanged'] },
        {
          kind: 'encounter',
          cause: { kind: 'rule', step: 'drawEncounterCard' },
          events: ['EncounterCardDrawn'],
        },
        {
          kind: 'board',
          cause: { kind: 'rule', step: 'drawEncounterCard' },
          events: ['CardMoved', 'CardFlipped'],
        },
        {
          kind: 'investigator',
          cause: { kind: 'card', cardId: rottingTreachery, window: { kind: 'revealed' } },
          events: ['InvestigatorChanged'],
        },
        // The treachery goes to the discard pile, which is shuffled back into the empty deck.
        {
          kind: 'board',
          cause: { kind: 'rule', step: 'drawEncounterCard' },
          events: ['CardMoved', 'CardMoved'],
        },
        {
          kind: 'encounter',
          cause: { kind: 'rule', step: 'drawEncounterCard' },
          events: ['DeckShuffled'],
        },
      ],
    },
  ])('$name', ({ command, notices }) => {
    const { context, state: started } = table.start();
    const before = command === next ? stateAfter(context, started, ...toUpkeep) : started;

    const result = execute(context, before, command);

    expect(
      changeNotices(result).map(({ kind, cause, events }) => ({
        kind,
        cause,
        events: events.map((event) => event.type),
      })),
    ).toEqual(notices);
  });

  it('gives no notice for what the players do themselves', () => {
    const { context, state } = table.start();
    const investigation = stateAfter(context, state, next);

    const result = execute(context, investigation, { type: 'StartTurn', investigatorId: alice });

    expect(result.causes.every((cause) => cause.kind === 'player')).toBe(true);
    expect(changeNotices(result)).toEqual([]);
  });
});

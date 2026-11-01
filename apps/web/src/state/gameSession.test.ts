import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import {
  blankLocation,
  byName,
  cardDbWith,
  execute,
  emptyState,
  investigatorCardStats,
  investigatorCode,
  investigatorId,
  instanceId,
  newGame,
  scenario,
  type InvestigatorCard,
  type ScenarioDefinition,
} from '@arkham/engine';
import { GATHERING_CODES, theGathering, theGatheringCards } from '@arkham/scenarios';
import { IndexedDbStore } from '../storage/IndexedDbStore';
import { GameSession, skippedEffects } from './gameSession';

describe('GameSession on The Gathering', () => {
  const alder: InvestigatorCard = {
    code: investigatorCode('alder'),
    name: 'Alder',
    health: 6,
    sanity: 8,
    skills: { willpower: 3, intellect: 3, combat: 3, agility: 3 },
  };
  const ctx = {
    cards: cardDbWith(theGatheringCards, [investigatorCardStats(alder)]),
    scenario: theGathering,
  };
  const setup = scenario.compileSetup(ctx, {
    difficulty: 'easy',
    seed: 3,
    investigators: [{ id: investigatorId('alder'), code: alder.code }],
  });

  /** A stored game of The Gathering, set up and not yet played, in database `name`. */
  async function storedGame(name: string) {
    const store = new IndexedDbStore(name);
    const gameId = await store.createGame({ title: 'The Gathering' });
    await store.appendEvents(gameId, execute(ctx, emptyState(), setup).events);
    return { store, gameId };
  }

  it('stores an action and its skill test as one undo group', async () => {
    const { store, gameId } = await storedGame('session-group-test');
    const session = await GameSession.open(store, gameId, ctx);
    await session.play((table) => table.nextPhase());
    await session.play((table) => table.startTurn(investigatorId('alder')));
    const beforeInvestigating = session.state;

    await session.play((table) => table.investigate(byName('Alder'), { result: 'fail' }));
    await store.undoLast(gameId);

    expect((await store.loadGame(gameId))?.state).toEqual(beforeInvestigating);
  });

  it('stores nothing of a step whose second verb is refused', async () => {
    const { store, gameId } = await storedGame('session-refused-step-test');
    const session = await GameSession.open(store, gameId, ctx);
    const atSetup = session.state;

    const rejection = await session.play((table) => {
      table.nextPhase();
      table.endTurn(investigatorId('alder'));
    });

    expect(rejection).toEqual({ code: 'turnNotInProgress', investigatorId: 'alder' });
    expect(session.state).toBe(atSetup);
    expect((await store.loadGame(gameId))?.state).toEqual(atSetup);
  });

  it('takes back a step in memory and in storage alike', async () => {
    const { store, gameId } = await storedGame('session-undo-test');
    const session = await GameSession.open(store, gameId, ctx);
    const atSetup = session.state;
    await session.play((table) => table.nextPhase());

    await session.undo();

    expect(session.state).toEqual(atSetup);
    expect((await store.loadGame(gameId))?.state).toEqual(atSetup);
  });

  it('goes back to right after a step of the log, in memory and in storage alike', async () => {
    const { store, gameId } = await storedGame('session-undo-to-test');
    const session = await GameSession.open(store, gameId, ctx);
    await session.play((table) => table.nextPhase());
    const afterNextPhase = session.state;
    const nextPhaseStep = session.entries.at(-1)?.commandId ?? '';
    await session.play((table) => table.startTurn(investigatorId('alder')));
    await session.play((table) => table.investigate(byName('Alder'), { result: 'fail' }));

    await session.undoTo(nextPhaseStep);

    expect(session.state).toEqual(afterNextPhase);
    expect((await store.loadGame(gameId))?.state).toEqual(afterNextPhase);
  });

  it.each([
    { case: 'a step the log does not hold', step: 'no_such_step' },
    { case: 'the newest step', step: 'newest' },
  ])('changes nothing when going back to $case', async ({ step }) => {
    const { store, gameId } = await storedGame(`session-undo-to-nothing-${step}`);
    const session = await GameSession.open(store, gameId, ctx);
    await session.play((table) => table.nextPhase());
    const afterNextPhase = session.state;
    const newest = session.entries.at(-1)?.commandId ?? '';

    await session.undoTo(step === 'newest' ? newest : step);

    expect(session.state).toEqual(afterNextPhase);
  });

  it('goes back to the scenario start, which stays', async () => {
    const { store, gameId } = await storedGame('session-undo-to-start-test');
    const session = await GameSession.open(store, gameId, ctx);
    const atSetup = session.state;
    const start = session.entries[0]?.commandId ?? '';
    await session.play((table) => table.nextPhase());
    await session.play((table) => table.startTurn(investigatorId('alder')));

    await session.undoTo(start);

    expect(session.state).toEqual(atSetup);
    expect(session.canUndo).toBe(false);
  });

  it('does not go back while the players adjust the board', async () => {
    const { store, gameId } = await storedGame('session-undo-to-adjusting-test');
    const session = await GameSession.open(store, gameId, ctx);
    const start = session.entries[0]?.commandId ?? '';
    await session.play((table) => table.nextPhase());
    session.startAdjusting();
    await session.play((table) => table.gainResources(investigatorId('alder'), 1));
    const adjusted = session.state;

    await session.undoTo(start);

    expect(session.state).toEqual(adjusted);
  });

  it('knows when each step was stored, also after reopening the game', async () => {
    const { store, gameId } = await storedGame('session-step-times-test');
    const session = await GameSession.open(store, gameId, ctx);
    await session.play((table) => table.nextPhase());
    const step = session.entries.at(-1)?.commandId ?? '';
    const [stored] = (await store.loadEvents(gameId)).filter((event) => event.commandId === step);

    const reopened = await GameSession.open(store, gameId, ctx);

    expect(session.stepTimes.get(step)).toBe(stored?.timestamp);
    expect(reopened.stepTimes.get(step)).toBe(stored?.timestamp);
  });

  describe('adjusting the board', () => {
    const alderId = investigatorId('alder');
    // Alder starts with 5 resources and no damage.
    const alderOn = (session: GameSession) => session.board.investigator(alderId);

    it('shows each tap at once but stores nothing until the adjustment is done', async () => {
      const { store, gameId } = await storedGame('session-adjust-unstored-test');
      const session = await GameSession.open(store, gameId, ctx);
      const atSetup = session.state;

      session.startAdjusting();
      await session.play((table) => table.gainResources(alderId, -2));

      expect(alderOn(session)).toMatchObject({ resources: 3 });
      expect((await store.loadGame(gameId))?.state).toEqual(atSetup);
    });

    it('stores every tap of the adjustment as one undo group on "Done"', async () => {
      const { store, gameId } = await storedGame('session-adjust-done-test');
      const session = await GameSession.open(store, gameId, ctx);
      const atSetup = session.state;
      session.startAdjusting();
      await session.play((table) => table.gainResources(alderId, -2));
      await session.play((table) => table.takeDamage(alderId, 1));

      await session.finishAdjusting();
      const adjusted = alderOn(session);
      const storedAdjusted = (await store.loadGame(gameId))?.state;
      const adjustedState = session.state;
      await session.undo();

      expect(adjusted).toMatchObject({ resources: 3, damage: 1 });
      expect(storedAdjusted).toEqual(adjustedState);
      expect(session.state).toEqual(atSetup);
      expect((await store.loadGame(gameId))?.state).toEqual(atSetup);
    });

    it('drops the taps on "Cancel"', async () => {
      const { store, gameId } = await storedGame('session-adjust-cancel-test');
      const session = await GameSession.open(store, gameId, ctx);
      const atSetup = session.state;
      session.startAdjusting();
      await session.play((table) => table.gainResources(alderId, -2));

      session.cancelAdjusting();

      expect(session.state).toEqual(atSetup);
      expect((await store.loadGame(gameId))?.state).toEqual(atSetup);
    });

    it("takes back only the adjustment's last tap on undo, never a stored step", async () => {
      const { store, gameId } = await storedGame('session-adjust-undo-test');
      const session = await GameSession.open(store, gameId, ctx);
      await session.play((table) => table.gainResources(alderId, 1));
      session.startAdjusting();
      await session.play((table) => table.takeDamage(alderId, 1));
      await session.play((table) => table.takeDamage(alderId, 1));

      await session.undo();
      const afterOneUndo = alderOn(session);
      await session.undo();
      await session.undo();

      expect(afterOneUndo).toMatchObject({ resources: 6, damage: 1 });
      expect(alderOn(session)).toMatchObject({ resources: 6, damage: 0 });
      expect(session.canUndo).toBe(false);
    });

    it('leaves a tap that changed nothing out of what undo takes back', async () => {
      const { store, gameId } = await storedGame('session-adjust-empty-tap-test');
      const session = await GameSession.open(store, gameId, ctx);
      await session.play((table) => table.gainResources(alderId, 1));
      session.startAdjusting();

      await session.play(() => {});
      await session.undo();

      expect(session.canUndo).toBe(false);
      expect(alderOn(session)).toMatchObject({ resources: 6 });
    });
  });

  it('names the effects a step skipped for a missing card, after a reload too, until the next step', async () => {
    // With two Ghoul Priests set aside, The Barrier's reverse side cannot tell which one spawns.
    const twoPriests: ScenarioDefinition = {
      ...theGathering,
      setup: theGathering.setup.map((step) =>
        step.kind === 'setAside'
          ? { ...step, codes: [...step.codes, GATHERING_CODES.ghoulPriest] }
          : step,
      ),
    };
    const twoPriestsCtx = { ...ctx, scenario: twoPriests };
    const store = new IndexedDbStore('session-skipped-effect-test');
    const gameId = await store.createGame({ title: 'The Gathering' });
    const twoPriestsSetup = scenario.compileSetup(twoPriestsCtx, {
      difficulty: 'easy',
      seed: 3,
      investigators: [{ id: investigatorId('alder'), code: alder.code }],
    });
    await store.appendEvents(gameId, execute(twoPriestsCtx, emptyState(), twoPriestsSetup).events);
    const session = await GameSession.open(store, gameId, twoPriestsCtx);
    // Act 1 (Trapped) advances first, without its clues, so that The Barrier is current.
    await session.play((table) => table.play({ type: 'AdvanceAct' }));

    await session.play((table) => table.play({ type: 'AdvanceAct' }));
    const afterTheBarrier = session.skippedEffects;
    const reopened = await GameSession.open(store, gameId, twoPriestsCtx);
    await session.play((table) => table.nextPhase());

    expect(afterTheBarrier).toEqual([
      { kind: 'missingCard', card: 'The Barrier', effect: 'SpawnEnemy', missing: ['Ghoul Priest'] },
    ]);
    expect(reopened.skippedEffects).toEqual(afterTheBarrier);
    expect(session.skippedEffects).toEqual([]);
  });

  // Seed 3 puts Dissonant Voices on top of the encounter deck.
  it('lists the encounter cards a step drew and where they went, until it is undone', async () => {
    const { store, gameId } = await storedGame('session-drawn-cards-test');
    const session = await GameSession.open(store, gameId, ctx);

    await session.play((table) => table.drawEncounterCard(investigatorId('alder')));
    const drawn = session.drawnCards.map(({ card, drawnFor, place }) => [
      card.name,
      drawnFor,
      place,
    ]);
    await session.undo();

    expect(drawn).toEqual([
      ['Dissonant Voices', 'alder', { kind: 'threatArea', investigator: 'alder' }],
    ]);
    expect(session.drawnCards).toEqual([]);
  });

  // Seed 3 puts Dissonant Voices on top of the encounter deck.
  it("shows the last step's drawn cards again when the game is opened anew", async () => {
    const { store, gameId } = await storedGame('session-drawn-cards-reload-test');
    const session = await GameSession.open(store, gameId, ctx);
    await session.play((table) => table.drawEncounterCard(investigatorId('alder')));

    const reopened = await GameSession.open(store, gameId, ctx);

    expect(
      reopened.drawnCards.map(({ card, drawnFor, place }) => [card.name, drawnFor, place]),
    ).toEqual([['Dissonant Voices', 'alder', { kind: 'threatArea', investigator: 'alder' }]]);
  });

  it("shows the earlier step's drawn cards again after the later step was undone", async () => {
    const { store, gameId } = await storedGame('session-undone-step-notices-test');
    const session = await GameSession.open(store, gameId, ctx);
    await session.play((table) => table.drawEncounterCard(investigatorId('alder')));
    await session.play((table) => table.nextPhase());
    await session.undo();

    const reopened = await GameSession.open(store, gameId, ctx);

    expect(reopened.drawnCards.map(({ card }) => card.name)).toEqual(['Dissonant Voices']);
  });

  it('opens a game with no step played yet without notices', async () => {
    const { store, gameId } = await storedGame('session-no-step-notices-test');

    const session = await GameSession.open(store, gameId, ctx);

    expect([session.drawnCards, session.skippedEffects]).toEqual([[], []]);
  });

  it("opens a game whose last step drew nothing without the earlier step's notices", async () => {
    const { store, gameId } = await storedGame('session-later-step-notices-test');
    const session = await GameSession.open(store, gameId, ctx);
    await session.play((table) => table.drawEncounterCard(investigatorId('alder')));
    await session.play((table) => table.nextPhase());

    const reopened = await GameSession.open(store, gameId, ctx);

    expect(reopened.drawnCards).toEqual([]);
  });

  it('reloads what another tab stored when its own write is refused', async () => {
    const { store, gameId } = await storedGame('session-two-tabs-test');
    const firstTab = await GameSession.open(store, gameId, ctx);
    const secondTab = await GameSession.open(store, gameId, ctx);
    await firstTab.play((table) => table.nextPhase());

    await expect(secondTab.play((table) => table.nextPhase())).rejects.toThrow();

    expect(secondTab.state).toEqual(firstTab.state);
  });
});

describe('skippedEffects', () => {
  it('names the investigator of a command the engine left to the players', () => {
    const southside = instanceId('southside');
    const alder = investigatorId('alder');
    const { context, state } = newGame()
      .withLocation(southside, blankLocation('southside'), { revealed: true })
      .withInvestigator(alder, { locationId: southside, name: 'Alder Ashcroft' })
      .start();

    const notices = skippedEffects({ ...context, scenario: theGathering }, state, [
      { type: 'CommandDeferred', command: { type: 'DrawCards', investigatorId: alder, amount: 3 } },
    ]);

    expect(notices).toEqual([
      {
        kind: 'deferred',
        investigator: 'Alder Ashcroft',
        command: { type: 'DrawCards', investigatorId: alder, amount: 3 },
      },
    ]);
  });

  it('names the card whose ability asked alder to draw', () => {
    const southside = instanceId('southside');
    const alder = investigatorId('alder');
    const { context, state } = newGame()
      .withLocation(southside, blankLocation('southside', { name: 'Southside' }), {
        revealed: true,
      })
      .withInvestigator(alder, { locationId: southside, name: 'Alder Ashcroft' })
      .start();
    const draw = {
      type: 'DrawCards',
      investigatorId: alder,
      amount: 3,
      source: { cardId: southside, window: 'action' },
    } as const;

    const notices = skippedEffects({ ...context, scenario: theGathering }, state, [
      { type: 'CommandDeferred', command: draw },
    ]);

    expect(notices).toEqual([
      { kind: 'deferred', card: 'Southside', investigator: 'Alder Ashcroft', command: draw },
    ]);
  });

  it('leaves out the play action alder took at the table, which needs no reminder', () => {
    const southside = instanceId('southside');
    const alder = investigatorId('alder');
    const { context, state } = newGame()
      .withLocation(southside, blankLocation('southside'), { revealed: true })
      .withInvestigator(alder, { locationId: southside, name: 'Alder Ashcroft' })
      .start();

    const notices = skippedEffects({ ...context, scenario: theGathering }, state, [
      {
        type: 'CommandDeferred',
        command: { type: 'PlayCard', investigatorId: alder, asAction: true },
      },
    ]);

    expect(notices).toEqual([]);
  });
});

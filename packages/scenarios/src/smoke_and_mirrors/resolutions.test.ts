import { describe, expect, it } from 'vitest';
import {
  campaign,
  cardDbWith,
  cardStats,
  investigatorCode,
  investigatorId,
  type CardInstance,
  type Command,
  type GameState,
  type InstanceId,
  type ProposedChange,
  type ScenarioContext,
} from '@arkham/engine';
import { standardInvestigatorCards, startScenario, stateAfter } from '@arkham/engine/test/utils';
import {
  ASH_STORY,
  SMOKE_AND_MIRRORS_CODES as codes,
  smokeAndMirrors,
  smokeAndMirrorsCards,
  smokeAndMirrorsResolutions,
} from '../index';

const ctx: ScenarioContext = {
  cards: cardDbWith(smokeAndMirrorsCards, standardInvestigatorCards),
  scenario: smokeAndMirrors,
};

const tank = investigatorCode(investigatorId('tank'));

/** The six cards setup dealt beneath locations: five suspects and the Servant of Flame. */
function dealt(state: GameState): CardInstance[] {
  return Object.values(state.cards).filter((card) => card.zone.kind === 'beneath');
}

/** The dealt card with `code`; fails the test if setup did not deal it. */
function dealtCopy(state: GameState, code: string): InstanceId {
  const card = dealt(state).find((candidate) => candidate.code === code);
  if (!card) throw new Error(`${code} was not dealt`);
  return card.id;
}

/** The current act's instance: Augurs of Flame, the scenario's only act. */
function actOf(state: GameState): InstanceId {
  return state.act.current!;
}

/** Moves `cards` to the victory display, face up. */
function toVictoryDisplay(cards: readonly InstanceId[]): Command[] {
  return cards.map((cardId) => ({ type: 'MoveCard', cardId, to: { kind: 'victoryDisplay' } }));
}

/** Moves `cards` beneath the act, as their codex entries would after they were drawn face up. */
function beneathTheAct(state: GameState, cards: readonly InstanceId[]): Command[] {
  return cards.flatMap((cardId): Command[] => [
    { type: 'MoveCard', cardId, to: { kind: 'engaged', investigatorId: investigatorId('tank') } },
    { type: 'MoveCard', cardId, to: { kind: 'beneath', hostId: actOf(state) } },
  ]);
}

/** The proposal once `commands`, the last of which ends the game, have run from `state`. */
function proposalAfter(state: GameState, ...commands: Command[]): ProposedChange[] {
  const ended = stateAfter(ctx, state, ...commands);
  return campaign.proposeResolution(ctx, ended, smokeAndMirrorsResolutions) ?? [];
}

const endInR1: Command = { type: 'AdvanceAct' };

describe('Smoke and Mirrors Resolution 1', () => {
  it('reveals the set-aside suspect as the harbinger and records the cult found', () => {
    const state = startScenario(ctx);
    const harbinger = Object.values(state.cards).find(
      (card) => card.zone.kind === 'setAside' && card.code !== codes.markOfElokoss,
    )!;

    const proposal = proposalAfter(state, endInR1);

    expect(proposal).toContainEqual({
      kind: 'command',
      command: {
        type: 'RecordStory',
        key: ASH_STORY.harbingerOfElokoss,
        value: { kind: 'list', entries: [cardStats(ctx.cards, harbinger.code).name] },
      },
    });
    expect(proposal).toContainEqual({
      kind: 'command',
      command: {
        type: 'RecordStory',
        key: ASH_STORY.discoveredTheCultsWhereabouts,
        value: { kind: 'flag', value: true },
      },
    });
  });

  it('adds the 2 cultist tokens to the campaign bag', () => {
    const proposal = proposalAfter(startScenario(ctx), endInR1);

    expect(
      proposal.filter(
        (change) => change.kind === 'command' && change.command.type === 'AddChaosToken',
      ),
    ).toEqual([
      { kind: 'command', command: { type: 'AddChaosToken', token: 'cultist' } },
      { kind: 'command', command: { type: 'AddChaosToken', token: 'cultist' } },
    ]);
  });

  it('records the killed Servant of Flame and its 1 victory point as experience', () => {
    const state = startScenario(ctx);

    const proposal = proposalAfter(
      state,
      ...toVictoryDisplay([dealtCopy(state, codes.servantOfFlame)]),
      endInR1,
    );

    expect(proposal).toContainEqual({
      kind: 'command',
      command: {
        type: 'RecordStory',
        key: ASH_STORY.killedTheServantOfFlame,
        value: { kind: 'flag', value: true },
      },
    });
    expect(proposal).toContainEqual({
      kind: 'command',
      command: { type: 'AwardXp', code: tank, amount: 1 },
    });
    expect(proposal).not.toContainEqual(
      expect.objectContaining({
        command: expect.objectContaining({ key: ASH_STORY.theServantOfFlameEscaped }),
      }),
    );
  });

  it('follows with Resolution 2 when the Servant of Flame is beneath the act', () => {
    const state = startScenario(ctx);

    const proposal = proposalAfter(
      state,
      ...beneathTheAct(state, [dealtCopy(state, codes.servantOfFlame)]),
      endInR1,
    );

    expect(proposal).toContainEqual({
      kind: 'command',
      command: {
        type: 'RecordStory',
        key: ASH_STORY.theServantOfFlameEscaped,
        value: { kind: 'flag', value: true },
      },
    });
    // 1 for the enemy beneath the act, then Resolution 2's 1 bonus experience.
    expect(
      proposal.filter((change) => change.kind === 'command' && change.command.type === 'AwardXp'),
    ).toEqual([
      { kind: 'command', command: { type: 'AwardXp', code: tank, amount: 1 } },
      { kind: 'command', command: { type: 'AwardXp', code: tank, amount: 1 } },
    ]);
  });

  // The six moved beneath the act stay face down, so the objective waits for the act to advance;
  // the sixth in the victory display meets it at once.
  it.each([
    { where: 'beneath the act', record: ASH_STORY.scouredArkhamForAnswers, beneath: true },
    { where: 'in the victory display', record: ASH_STORY.stirredUpTrouble, beneath: false },
  ])('records $record with all six Elite enemies $where', ({ record, beneath }) => {
    const state = startScenario(ctx);
    const six = dealt(state).map((card) => card.id);

    const proposal = proposalAfter(
      state,
      ...(beneath ? [...beneathTheAct(state, six), endInR1] : toVictoryDisplay(six)),
    );

    expect(proposal).toContainEqual({
      kind: 'command',
      command: { type: 'RecordStory', key: record, value: { kind: 'flag', value: true } },
    });
  });
});

describe('Smoke and Mirrors without a resolution', () => {
  /** Arkham Alive gives everyone a Mark of Elokoss, then Emergent Evils makes them all resign. */
  const bothAgendas: Command[] = [{ type: 'AdvanceAgenda' }, { type: 'AdvanceAgenda' }];

  it('asks whether the drawn card was the harbinger, failed in their search until they pick', () => {
    const proposal = proposalAfter(startScenario(ctx), ...bothAgendas);

    expect(proposal).toContainEqual({
      kind: 'byHand',
      textKey: 'scenario.smokeAndMirrors.resolution.drawForTheHarbinger',
    });
    expect(proposal).toContainEqual({
      kind: 'choice',
      options: [false, true].map((value) => ({
        type: 'RecordStory',
        key: ASH_STORY.discoveredTheCultsWhereabouts,
        value: { kind: 'flag', value },
      })),
    });
  });

  it('makes each investigator the bearer of the Mark of Elokoss Arkham Alive gave them', () => {
    const proposal = proposalAfter(startScenario(ctx, { playerCount: 2 }), ...bothAgendas);

    expect(proposal).toContainEqual({
      kind: 'command',
      command: { type: 'EarnCard', code: tank, card: codes.markOfElokoss },
    });
    expect(proposal).toContainEqual({
      kind: 'command',
      command: {
        type: 'EarnCard',
        code: investigatorCode(investigatorId('seeker')),
        card: codes.markOfElokoss,
      },
    });
  });
});

describe('Smoke and Mirrors before Arkham Alive advanced', () => {
  it('gives nobody a Mark of Elokoss', () => {
    const proposal = proposalAfter(startScenario(ctx), endInR1);

    expect(proposal).not.toContainEqual(
      expect.objectContaining({ command: expect.objectContaining({ type: 'EarnCard' }) }),
    );
  });
});

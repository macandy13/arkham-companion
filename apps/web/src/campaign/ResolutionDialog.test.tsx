// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  campaign,
  campaignId,
  cardCode,
  emptyState,
  investigatorCode,
  resolutionId,
  scenarioId,
  type CampaignCommand,
  type CampaignInvestigator,
  type GameState,
  type ProposedChange,
  type ScenarioOutcome,
} from '@arkham/engine';
import type { ResolutionOption } from '../state/appStore';
import { initI18n } from '../i18n';
import { ResolutionDialog } from './ResolutionDialog';

const roland = investigatorCode('01001');
const daisy = investigatorCode('01002');
const litaChantler = cardCode('01117');

function member(code: CampaignInvestigator['code'], name: string): CampaignInvestigator {
  return {
    code,
    name,
    health: 9,
    sanity: 5,
    physicalTrauma: 0,
    mentalTrauma: 0,
    xpEarned: 0,
    xpSpent: 0,
    fate: 'alive',
    earnedCards: [],
  };
}

/** The Gathering, ended with `resolution`, played by Roland Banks and Daisy Walker in a campaign. */
function gatheringEndedWith(resolution: string | undefined): GameState {
  const state = emptyState();
  return {
    ...state,
    meta: {
      ...state.meta,
      scenarioId: scenarioId('the-gathering'),
      ended: true,
      resolution: resolution === undefined ? undefined : resolutionId(resolution),
    },
    campaign: {
      ...campaign.createEmptyLog(),
      investigators: [member(roland, 'Roland Banks'), member(daisy, 'Daisy Walker')],
    },
  };
}

/** Renders the dialog over `game` with `options`, in a Zealot campaign unless `inCampaign: false`. */
function renderDialog(
  game: GameState,
  options: readonly ResolutionOption[],
  { failed = false, inCampaign = true } = {},
) {
  const onWrite =
    vi.fn<(outcome: ScenarioOutcome, confirmed: readonly CampaignCommand[]) => void>();
  const onLater = vi.fn();
  render(
    <ResolutionDialog
      game={game}
      resolution={{
        reached: campaign.gameOutcome(game),
        options,
        campaignId: inCampaign ? campaignId('zealot') : undefined,
      }}
      busy={false}
      failed={failed}
      onWrite={onWrite}
      onLater={onLater}
    />,
  );
  return { onWrite, onLater };
}

/** The dialog with only the resolution `game` reached, whose `changes` it shows after "Next". */
function renderChanges(game: GameState, changes: readonly ProposedChange[], failed = false) {
  const rendered = renderDialog(game, [{ outcome: campaign.gameOutcome(game), changes }], {
    failed,
  });
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  return rendered;
}

const r1 = { kind: 'resolution', id: resolutionId('R1') } as const;
const r2 = { kind: 'resolution', id: resolutionId('R2') } as const;
const houseBurned: CampaignCommand = {
  type: 'RecordStory',
  key: 'houseStillStanding',
  value: { kind: 'flag', value: false },
};
const rolandXp: CampaignCommand = { type: 'AwardXp', code: roland, amount: 6 };
const upgradeDecks: ProposedChange = {
  kind: 'byHand',
  textKey: 'scenario.theGathering.resolution.upgradeDecks',
};

describe('ResolutionDialog', () => {
  beforeAll(async () => {
    await initI18n('en');
  });
  afterEach(cleanup);

  it('names the resolution to read aloud and lists its changes like the log page', () => {
    renderChanges(gatheringEndedWith('R1'), [
      { kind: 'command', command: houseBurned },
      { kind: 'command', command: rolandXp },
      { kind: 'command', command: { type: 'EarnCard', code: roland, card: litaChantler } },
      upgradeDecks,
    ]);

    const dialog = screen.getByRole('dialog', { name: 'Into the campaign log' });
    expect(within(dialog).getByText('The Gathering · Resolution 1')).toBeTruthy();
    expect(
      within(dialog).getByText('Read Resolution 1 aloud from the campaign guide.'),
    ).toBeTruthy();
    const group = (name: string) =>
      within(within(dialog).getByRole('region', { name }))
        .getAllByRole('listitem')
        .map((item) => item.textContent);
    expect(group('Campaign Notes')).toEqual(['Your house burned to the ground.']);
    expect(group('Investigators')).toEqual([
      'Roland Banks earns 6 experience',
      'Roland Banks earns Lita Chantler',
    ]);
    expect(group('Chaos Bag')).toEqual(['No change.']);
    expect(group('At the table')).toEqual([
      'Each investigator spends experience on deck upgrades.',
    ]);
  });

  it('points at the "No resolution" text when the game ended without one', () => {
    renderChanges(gatheringEndedWith(undefined), [upgradeDecks]);

    expect(screen.getByText('The Gathering · No resolution')).toBeTruthy();
    expect(
      screen.getByText('Read the "No resolution" text aloud from the campaign guide.'),
    ).toBeTruthy();
  });

  it('writes the commands without the by-hand steps', () => {
    const { onWrite } = renderChanges(gatheringEndedWith('R1'), [
      { kind: 'command', command: houseBurned },
      upgradeDecks,
      { kind: 'command', command: rolandXp },
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Write into the log' }));

    expect(onWrite).toHaveBeenCalledWith(r1, [houseBurned, rolandXp]);
  });

  describe('when Daisy was defeated by damage and horror at once', () => {
    const physical: CampaignCommand = {
      type: 'AddTrauma',
      code: daisy,
      kind: 'physical',
      amount: 1,
    };
    const mental: CampaignCommand = { type: 'AddTrauma', code: daisy, kind: 'mental', amount: 1 };
    const daisyDefeat: ProposedChange = { kind: 'choice', options: [physical, mental] };

    it('writes the physical trauma until the players pick another', () => {
      const { onWrite } = renderChanges(gatheringEndedWith('R1'), [daisyDefeat]);

      fireEvent.click(screen.getByRole('button', { name: 'Write into the log' }));

      expect(onWrite).toHaveBeenCalledWith(r1, [physical]);
    });

    it('writes the trauma the players picked', () => {
      const { onWrite } = renderChanges(gatheringEndedWith('R1'), [daisyDefeat]);

      fireEvent.click(screen.getByRole('radio', { name: 'Daisy Walker suffers 1 mental trauma' }));
      fireEvent.click(screen.getByRole('button', { name: 'Write into the log' }));

      expect(onWrite).toHaveBeenCalledWith(r1, [mental]);
    });
  });

  describe('when The Gathering ended with resolution 1', () => {
    const options: readonly ResolutionOption[] = [
      { outcome: r1, changes: [{ kind: 'command', command: houseBurned }] },
      { outcome: r2, changes: [{ kind: 'command', command: rolandXp }] },
    ];

    it('offers its resolutions, resolution 1 tagged as the one from the game', () => {
      renderDialog(gatheringEndedWith('R1'), options);

      const dialog = screen.getByRole('dialog', { name: 'The scenario is over' });
      expect(
        within(dialog).getByRole('radio', { name: 'Resolution 1 from the game' }),
      ).toHaveProperty('checked', true);
      expect(within(dialog).getByRole('radio', { name: 'Resolution 2' })).toHaveProperty(
        'checked',
        false,
      );
    });

    it('writes resolution 2 with its changes once the players pick it', () => {
      const { onWrite } = renderDialog(gatheringEndedWith('R1'), options);

      fireEvent.click(screen.getByRole('radio', { name: 'Resolution 2' }));
      expect(screen.getByText('Read Resolution 2 aloud from the campaign guide.')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      expect(screen.getByText('The Gathering · Resolution 2')).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Write into the log' }));

      expect(onWrite).toHaveBeenCalledWith(r2, [rolandXp]);
    });
  });

  it('lists the steps of a standalone game and closes on "Done" without writing', () => {
    const { onWrite, onLater } = renderDialog(
      gatheringEndedWith('R1'),
      [{ outcome: r1, changes: [upgradeDecks] }],
      { inCampaign: false },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('dialog', { name: 'Resolution steps' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(onLater).toHaveBeenCalled();
    expect(onWrite).not.toHaveBeenCalled();
  });

  it('leaves the game as it is on "Not yet"', () => {
    const { onWrite, onLater } = renderDialog(gatheringEndedWith('R1'), [
      { outcome: r1, changes: [upgradeDecks] },
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Not yet' }));

    expect(onLater).toHaveBeenCalled();
    expect(onWrite).not.toHaveBeenCalled();
  });

  it('says the log refused the last write', () => {
    renderChanges(gatheringEndedWith('R1'), [upgradeDecks], true);

    expect(screen.getByRole('alert').textContent).toMatch(/refused these changes/);
  });
});

// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useParams } from 'react-router';
import type { CardCatalog } from '@arkham/carddata';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  campaignDefinitionId,
  cardCode,
  investigatorCode,
  resolutionId,
  scenarioId,
  type CampaignEvent,
  type CampaignId,
  type ScenarioOutcome,
} from '@arkham/engine';
import { initI18n } from '../i18n';
import { createAppStore } from '../state/appStore';
import { IndexedDbStore } from '../storage/IndexedDbStore';
import { CampaignScreen } from './CampaignScreen';

let n = 0;
const roland = investigatorCode('01001');
const litaChantler = cardCode('01117');
const gathering = scenarioId('the-gathering');
const midnightMasks = scenarioId('the-midnight-masks');

/** A Night of the Zealot campaign on Standard of Roland Banks alone, its chaos bag a single 0, then `events` on its log. */
async function storeCampaign(events: (id: CampaignId) => CampaignEvent[]) {
  const gameStore = new IndexedDbStore(`campaign-screen-test-${n++}`);
  const campaignId = await gameStore.createCampaign({ title: 'Zealot – Roland' });
  await gameStore.appendCampaignEvents(campaignId, [
    {
      type: 'CampaignStarted',
      campaignId,
      definitionId: campaignDefinitionId('night-of-the-zealot'),
      difficulty: 'standard',
      investigators: [
        {
          code: roland,
          name: 'Roland Banks',
          health: 9,
          sanity: 5,
          physicalTrauma: 0,
          mentalTrauma: 0,
          xpEarned: 0,
          xpSpent: 0,
          fate: 'alive',
          earnedCards: [],
        },
      ],
      chaosBag: ['0'],
      scenarioIds: [gathering, midnightMasks, scenarioId('the-devourer-below')],
    },
    ...events(campaignId),
  ]);
  return { gameStore, campaignId };
}

/** The catalog the setup preview takes the team's card stats from: Roland Banks alone. */
const rolandCatalog: CardCatalog = {
  packs: [{ code: 'core', name: 'Core Set', position: 1, cyclePosition: 1, chapter: 1 }],
  investigators: [
    {
      code: '01001',
      name: 'Roland Banks',
      factionCode: 'guardian',
      health: 9,
      sanity: 5,
      skills: { willpower: 3, intellect: 3, combat: 4, agility: 2 },
      packCode: 'core',
      cyclePosition: 1,
      parallel: false,
      chapter: 1,
    },
  ],
};

/** The catalog of a replacement for Roland: Daisy Walker beside him. */
const rolandAndDaisyCatalog: CardCatalog = {
  ...rolandCatalog,
  investigators: [
    ...rolandCatalog.investigators,
    {
      code: '01002',
      name: 'Daisy Walker',
      factionCode: 'seeker',
      health: 5,
      sanity: 9,
      skills: { willpower: 3, intellect: 5, combat: 2, agility: 2 },
      packCode: 'core',
      cyclePosition: 1,
      parallel: false,
      chapter: 1,
    },
  ],
};

/** Stands in for the play screen: names the game the campaign screen went to. */
function GameRoute() {
  return <output>{`game ${useParams().id}`}</output>;
}

function renderLog(
  gameStore: IndexedDbStore,
  path: string,
  store = createAppStore(gameStore),
  catalog = rolandCatalog,
) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/campaign/:id"
          element={<CampaignScreen store={store} catalog={() => Promise.resolve(catalog)} />}
        />
        <Route path="/game/:id" element={<GameRoute />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CampaignScreen', () => {
  beforeAll(async () => {
    await initI18n('en');
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  describe('after The Gathering, won with resolution 1', () => {
    async function renderPlayedLog() {
      const { gameStore, campaignId } = await storeCampaign(() => [
        {
          type: 'ScenarioPlayed',
          scenarioId: gathering,
          outcome: { kind: 'resolution', id: resolutionId('R1') },
        },
        { type: 'ScenarioPositionChanged', position: 1 },
        { type: 'XpChanged', code: roland, account: 'earned', delta: 5 },
        { type: 'XpChanged', code: roland, account: 'spent', delta: 2 },
        { type: 'TraumaChanged', code: roland, kind: 'mental', delta: 1 },
        { type: 'CardEarned', code: roland, card: litaChantler },
      ]);
      renderLog(gameStore, `/campaign/${campaignId}`);
      return screen.findByRole('region', { name: 'Investigators' });
    }

    it("writes Roland's experience, trauma and earned card in his column", async () => {
      const investigators = await renderPlayedLog();

      expect(screen.getByRole('heading', { name: 'Night of the Zealot' })).toBeTruthy();
      expect(within(investigators).getByText('Roland Banks')).toBeTruthy();
      expect(within(investigators).getByText('3')).toBeTruthy();
      expect(within(investigators).getByText('5 earned, 2 spent')).toBeTruthy();
      expect(within(investigators).getByRole('img', { name: '1 trauma' })).toBeTruthy();
      expect(within(investigators).getByText('Lita Chantler')).toBeTruthy();
    });

    it('leaves three blank columns beside his, as the printed card has room for four', async () => {
      const investigators = await renderPlayedLog();

      const [rolandColumn, ...blankColumns] = within(investigators).getAllByRole('listitem');
      expect(rolandColumn?.textContent).toContain('Roland Banks');
      expect(blankColumns.map((column) => column.textContent)).toEqual(
        Array(3).fill(
          'InvestigatorUnspent experienceTraumaPhysicalMentalEarned story assets / weaknesses',
        ),
      );
    });

    it('ticks The Gathering with R1 and marks The Midnight Masks as next', async () => {
      await renderPlayedLog();
      const scenarios = screen.getByRole('region', { name: 'Scenarios' });

      const gatheringItem = within(scenarios).getByText('The Gathering').closest('li')!;
      expect(within(gatheringItem).getByRole('checkbox')).toHaveProperty('checked', true);
      expect(within(gatheringItem).getByText('R1')).toBeTruthy();
      const masksItem = within(scenarios).getByText('The Midnight Masks').closest('li')!;
      expect(within(masksItem).getByRole('checkbox')).toHaveProperty('checked', false);
      expect(masksItem.getAttribute('aria-current')).toBe('step');
    });
  });

  describe('right after resolution 1 of The Gathering was written', () => {
    async function renderWrittenLog() {
      const { gameStore, campaignId } = await storeCampaign(() => []);
      const written = await gameStore.appendCampaignEvents(campaignId, [
        {
          type: 'ScenarioPlayed',
          scenarioId: gathering,
          outcome: { kind: 'resolution', id: resolutionId('R1') },
        },
        { type: 'ScenarioPositionChanged', position: 1 },
      ]);
      const store = createAppStore(gameStore);
      store.setState({ writtenResolution: { campaignId, seq: written.at(-1)!.seq } });
      renderLog(gameStore, `/campaign/${campaignId}`, store);
      return screen.findByRole('status', { name: 'Written into the log' });
    }

    it('takes the resolution back out of the log on "Undo"', async () => {
      const toast = await renderWrittenLog();
      expect(screen.getByText('R1')).toBeTruthy();

      fireEvent.click(within(toast).getByRole('button', { name: 'Undo' }));

      await waitFor(() => expect(screen.queryByText('R1')).toBeNull());
      expect(screen.queryByRole('status', { name: 'Written into the log' })).toBeNull();
    });

    it('keeps the resolution and closes the toast on "OK"', async () => {
      const toast = await renderWrittenLog();

      fireEvent.click(within(toast).getByRole('button', { name: 'OK' }));

      expect(screen.queryByRole('status', { name: 'Written into the log' })).toBeNull();
      expect(screen.getByText('R1')).toBeTruthy();
    });
  });

  describe('after The Midnight Masks', () => {
    async function renderNotepad() {
      const { gameStore, campaignId } = await storeCampaign(() => [
        { type: 'StoryRecorded', key: 'itIsPastMidnight', value: { kind: 'flag', value: true } },
        { type: 'StoryRecorded', key: 'houseStillStanding', value: { kind: 'flag', value: false } },
        {
          type: 'StoryRecorded',
          key: 'ghoulPriestStillAlive',
          value: { kind: 'flag', value: false },
        },
        {
          type: 'StoryRecorded',
          key: 'cultistsWeInterrogated',
          value: { kind: 'list', entries: ['Herman Collins'] },
        },
        {
          type: 'StoryRecorded',
          key: 'cultistsWhoGotAway',
          value: {
            kind: 'crossableList',
            entries: [
              { name: 'Ruth Turner', crossedOut: false },
              { name: 'Peter Warren', crossedOut: true },
            ],
          },
        },
      ]);
      renderLog(gameStore, `/campaign/${campaignId}`);
      return screen.findByRole('region', { name: 'Campaign Notes' });
    }

    it('writes the notes the log holds, in the order the guide records them', async () => {
      const notes = await renderNotepad();

      expect(
        within(notes)
          .getAllByRole('listitem')
          .map((note) => note.textContent),
      ).toEqual(['Your house burned to the ground.', 'It was past midnight.']);
    });

    it('lists the cultists interrogated and those who got away, a caught one crossed out', async () => {
      await renderNotepad();

      const interrogated = screen.getByRole('region', { name: 'Cultists We Interrogated' });
      expect(within(interrogated).getByText('Herman Collins')).toBeTruthy();
      const gotAway = screen.getByRole('region', { name: 'Cultists Who Got Away' });
      expect(within(gotAway).getByText('Ruth Turner').tagName).toBe('LI');
      expect(within(gotAway).getByText('Peter Warren').tagName).toBe('DEL');
    });
  });

  describe('after Roland was killed, his replacement Daisy went insane', () => {
    const daisy = investigatorCode('01002');

    async function renderFallen() {
      const { gameStore, campaignId } = await storeCampaign(() => [
        { type: 'InvestigatorFateChanged', code: roland, fate: 'killed' },
        {
          type: 'InvestigatorReplaced',
          code: roland,
          by: {
            code: daisy,
            name: 'Daisy Walker',
            health: 5,
            sanity: 9,
            physicalTrauma: 0,
            mentalTrauma: 0,
            xpEarned: 0,
            xpSpent: 0,
            fate: 'alive',
            earnedCards: [],
          },
        },
        { type: 'InvestigatorFateChanged', code: daisy, fate: 'insane' },
        { type: 'ChaosTokenAdded', token: 'skull' },
        { type: 'ChaosTokenAdded', token: '0' },
      ]);
      renderLog(gameStore, `/campaign/${campaignId}`);
      return screen.findByRole('region', { name: 'Killed and Insane Investigators' });
    }

    it('lists both on the clipping, Roland first', async () => {
      const clipping = await renderFallen();

      expect(
        within(clipping)
          .getAllByRole('listitem')
          .map((item) => item.textContent),
      ).toEqual(['Roland Banks – killed', 'Daisy Walker – insane']);
    });

    it('notes the starting 0, the 0 and the skull added as one entry per kind with its count', async () => {
      await renderFallen();
      const bag = screen.getByRole('region', { name: 'Chaos Bag' });

      expect(
        within(bag)
          .getAllByRole('listitem')
          .map((item) => item.textContent),
      ).toEqual(['0 ×2', 'Skull']);
    });
  });

  it('marks a killed investigator', async () => {
    const { gameStore, campaignId } = await storeCampaign(() => [
      { type: 'InvestigatorFateChanged', code: roland, fate: 'killed' },
    ]);

    renderLog(gameStore, `/campaign/${campaignId}`);

    expect(await screen.findByText('killed')).toBeTruthy();
  });

  it('continues the game of the scenario in play', async () => {
    const { gameStore, campaignId } = await storeCampaign(() => []);
    const gameId = await gameStore.createGame({ title: 'The Gathering – Roland', campaignId });
    await gameStore.appendEvents(gameId, [
      {
        type: 'ScenarioStarted',
        scenarioId: gathering,
        difficulty: 'standard',
        seed: 1,
        investigators: [],
        maps: {},
        cards: [],
        chaosBag: ['0'],
      },
    ]);

    renderLog(gameStore, `/campaign/${campaignId}`);

    const link = await screen.findByRole('link', { name: 'Continue The Gathering' });
    expect(link.getAttribute('href')).toBe(`/game/${gameId}`);
  });

  describe('after The Gathering on Standard, in which Roland earned 5 experience and spent 2', () => {
    async function renderLogBeforeMasks() {
      const { gameStore, campaignId } = await storeCampaign(() => [
        {
          type: 'ScenarioPlayed',
          scenarioId: gathering,
          outcome: { kind: 'resolution', id: resolutionId('R1') },
        },
        { type: 'ScenarioPositionChanged', position: 1 },
        { type: 'XpChanged', code: roland, account: 'earned', delta: 5 },
        { type: 'XpChanged', code: roland, account: 'spent', delta: 2 },
      ]);
      renderLog(gameStore, `/campaign/${campaignId}`);
      fireEvent.click(await screen.findByRole('button', { name: 'Set up The Midnight Masks' }));
      return {
        gameStore,
        campaignId,
        dialog: screen.getByRole('dialog', { name: 'Set up The Midnight Masks' }),
      };
    }

    it('reminds the players of his 3 unspent experience before The Midnight Masks', async () => {
      const { dialog } = await renderLogBeforeMasks();

      const upgrades = within(dialog).getByRole('region', { name: 'Deck upgrades' });
      expect(within(upgrades).getByRole('listitem').textContent).toBe(
        'Roland Banks: 3 unspent experience',
      );
      expect(within(dialog).getByText('Standard')).toBeTruthy();
    });

    it('says where the investigators start, as the log has no house still standing', async () => {
      const { dialog } = await renderLogBeforeMasks();

      const fromTheLog = within(dialog).getByRole('region', { name: 'From the campaign log' });
      expect(within(fromTheLog).getByRole('term').textContent).toBe(
        'Your house burned to the ground.',
      );
      expect(within(fromTheLog).getByRole('definition').textContent).toBe(
        'The investigators start at Rivertown',
      );
    });

    it('sets The Midnight Masks up as a game of the campaign and goes to it', async () => {
      const { gameStore, campaignId, dialog } = await renderLogBeforeMasks();

      const startButton = within(dialog).getByRole('button', { name: 'Start game' });
      await waitFor(() => expect(startButton).toHaveProperty('disabled', false));
      fireEvent.click(startButton);

      const shown = await screen.findByRole('status');
      const [game] = await gameStore.listGames();
      expect(shown.textContent).toBe(`game ${game?.gameId}`);
      expect(game).toMatchObject({
        title: 'The Midnight Masks – Roland Banks',
        scenarioId: midnightMasks,
        campaignId,
      });
    });
  });

  describe('after The Gathering, in which Roland was killed', () => {
    async function openSetupWith(catalog: CardCatalog) {
      const { gameStore, campaignId } = await storeCampaign(() => [
        { type: 'InvestigatorFateChanged', code: roland, fate: 'killed' },
        {
          type: 'ScenarioPlayed',
          scenarioId: gathering,
          outcome: { kind: 'resolution', id: resolutionId('R3') },
        },
        { type: 'ScenarioPositionChanged', position: 1 },
      ]);
      const store = createAppStore(gameStore);
      renderLog(gameStore, `/campaign/${campaignId}`, store, catalog);
      fireEvent.click(await screen.findByRole('button', { name: 'Set up The Midnight Masks' }));
      return {
        gameStore,
        campaignId,
        dialog: screen.getByRole('dialog', { name: 'Set up The Midnight Masks' }),
      };
    }

    it('sets The Midnight Masks up with Daisy Walker, picked to replace him', async () => {
      const { gameStore, campaignId, dialog } = await openSetupWith(rolandAndDaisyCatalog);
      const startButton = within(dialog).getByRole('button', { name: 'Start game' });

      fireEvent.click(
        await within(dialog).findByRole('button', {
          name: 'Choose a replacement for Roland Banks',
        }),
      );
      const picker = screen.getByRole('dialog', { name: 'Replace Roland Banks' });
      fireEvent.click(within(picker).getByRole('button', { name: /Daisy Walker/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Select' }));
      fireEvent.click(within(picker).getByRole('button', { name: 'Choose' }));

      expect(within(dialog).getByText('Daisy Walker takes their place.')).toBeTruthy();
      expect(startButton).toHaveProperty('disabled', false);
      fireEvent.click(startButton);
      await screen.findByRole('status');
      const [game] = await gameStore.listGames();
      expect(game?.title).toBe('The Midnight Masks – Daisy Walker');
      const log = (await gameStore.loadCampaign(campaignId))?.log;
      expect(log?.investigators.map(({ name }) => name)).toEqual(['Daisy Walker']);
    });

    it('ends the campaign as lost when no investigator is left to replace him', async () => {
      const { dialog } = await openSetupWith(rolandCatalog);

      expect(
        await within(dialog).findByText(
          'No investigator is left to choose: the campaign is over and the players lose.',
        ),
      ).toBeTruthy();
      expect(within(dialog).getByRole('button', { name: 'Start game' })).toHaveProperty(
        'disabled',
        true,
      );
      fireEvent.click(within(dialog).getByRole('button', { name: 'End the campaign' }));

      const over = await screen.findByRole('region', { name: 'Campaign over' });
      expect(within(over).getByText('Lost')).toBeTruthy();
    });
  });

  it.each<{ outcome: ScenarioOutcome; result: 'won' | 'survived'; says: string; read: string }>([
    {
      outcome: { kind: 'resolution', id: resolutionId('R1') },
      result: 'won',
      says: 'Won',
      read: 'Read Resolution 1 of The Devourer Below in the campaign guide.',
    },
    {
      outcome: { kind: 'noResolution' },
      result: 'survived',
      says: 'Survived',
      read: 'Read the "No resolution" text of The Devourer Below in the campaign guide.',
    },
  ])(
    'after The Devourer Below ended with $outcome.kind on 31 October 2026, stamps "$says" and says "$read"',
    async ({ outcome, result, says, read }) => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 9, 31, 22, 0));
      const { gameStore, campaignId } = await storeCampaign(() => [
        ...[gathering, midnightMasks].flatMap((scenario, position): CampaignEvent[] => [
          {
            type: 'ScenarioPlayed',
            scenarioId: scenario,
            outcome: { kind: 'resolution', id: resolutionId('R1') },
          },
          { type: 'ScenarioPositionChanged', position: position + 1 },
        ]),
        { type: 'ScenarioPlayed', scenarioId: scenarioId('the-devourer-below'), outcome },
        { type: 'ScenarioPositionChanged', position: 3 },
        { type: 'CampaignEnded', result },
      ]);

      renderLog(gameStore, `/campaign/${campaignId}`);

      const stamp = await screen.findByRole('region', { name: 'Campaign over' });
      expect(within(stamp).getByText(says)).toBeTruthy();
      expect(within(stamp).getByText('October 31, 2026')).toBeTruthy();
      expect(screen.getByText(read)).toBeTruthy();
      expect(screen.queryByRole('button', { name: /Set up/ })).toBeNull();
    },
  );

  it('says so when the campaign is not on this device', async () => {
    const { gameStore } = await storeCampaign(() => []);

    renderLog(gameStore, '/campaign/gone');

    expect((await screen.findByRole('alert')).textContent).toBe(
      'This campaign is not on this device.',
    );
  });
});

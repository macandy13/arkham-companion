// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  campaignDefinitionId,
  cardCode,
  investigatorCode,
  resolutionId,
  scenarioId,
  type CampaignEvent,
  type CampaignId,
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

/** A Night of the Zealot campaign of Roland Banks alone, then `events` on its log. */
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

function renderLog(gameStore: IndexedDbStore, path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/campaign/:id"
          element={<CampaignScreen store={createAppStore(gameStore)} />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CampaignScreen', () => {
  beforeAll(async () => {
    await initI18n('en');
  });
  afterEach(cleanup);

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

  describe('after The Midnight Masks', () => {
    async function renderNotepad() {
      const { gameStore, campaignId } = await storeCampaign(() => [
        { type: 'StoryRecorded', key: 'houseStillStanding', value: { kind: 'flag', value: false } },
        {
          type: 'StoryRecorded',
          key: 'ghoulPriestStillAlive',
          value: { kind: 'flag', value: false },
        },
        { type: 'StoryRecorded', key: 'itIsPastMidnight', value: { kind: 'flag', value: true } },
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

  it('says so when the campaign is not on this device', async () => {
    const { gameStore } = await storeCampaign(() => []);

    renderLog(gameStore, '/campaign/gone');

    expect((await screen.findByRole('alert')).textContent).toBe(
      'This campaign is not on this device.',
    );
  });
});

// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { CardCatalog } from '@arkham/carddata';
import { STATE_VERSION, campaignDefinitionId, investigatorCode, scenarioId } from '@arkham/engine';
import { initI18n } from '../i18n';
import { createAppStore } from '../state/appStore';
import { IndexedDbStore } from '../storage/IndexedDbStore';
import { HomeScreen } from './HomeScreen';

/** A catalog that never loads, so the portraits keep their initials. */
const catalogLoading = () => new Promise<CardCatalog>(() => undefined);

/** A catalog with Roland Banks alone, without a card picture. */
const rolandCatalog: CardCatalog = {
  packs: [],
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

let n = 0;
async function renderHome(titles: string[]) {
  const gameStore = new IndexedDbStore(`home-test-${n++}`);
  for (const title of titles) await gameStore.createGame({ title });
  const store = createAppStore(gameStore);
  render(
    <MemoryRouter>
      <HomeScreen store={store} catalog={catalogLoading} />
    </MemoryRouter>,
  );
  return store;
}

describe('HomeScreen', () => {
  beforeAll(async () => {
    await initI18n('en');
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('names the app in its title and says what it does', async () => {
    await renderHome([]);

    expect(await screen.findByRole('heading', { level: 1, name: 'Arkham Companion' })).toBeTruthy();
    expect(screen.getByText('keeps the scenario while you play the cards')).toBeTruthy();
  });

  it.each([
    ['New campaign', '/new?mode=campaign'],
    ['One scenario', '/new?mode=quick'],
  ])('starts a game from the title with %s', async (name, href) => {
    await renderHome(['The house is open']);

    const ways = await screen.findByRole('navigation', { name: 'Start or load a game' });

    expect(within(ways).getByRole('link', { name }).getAttribute('href')).toBe(href);
  });

  it('marks New campaign as the brass primary of the title', async () => {
    await renderHome([]);

    const ways = await screen.findByRole('navigation', { name: 'Start or load a game' });

    expect(
      within(ways)
        .getAllByRole('link')
        .filter((link) => link.hasAttribute('data-primary'))
        .map((link) => link.textContent),
    ).toEqual(['New campaign']);
  });

  it('says there are no saved games yet', async () => {
    await renderHome([]);

    expect(await screen.findByText('No games yet')).toBeTruthy();
  });

  it.each([
    ['still going', [], 'Chapter 1: The Gathering', 'Set up chapter 1'],
    [
      'won',
      [{ type: 'CampaignEnded', result: 'won' } as const],
      'The investigators won',
      'Read the log',
    ],
  ])(
    'shows a campaign %s on a cover with where it stands and a way to its log',
    async (_, ending, standing, link) => {
      const gameStore = new IndexedDbStore(`home-test-${n++}`);
      const campaignId = await gameStore.createCampaign({ title: 'Zealot – Roland' });
      await gameStore.appendCampaignEvents(campaignId, [
        {
          type: 'CampaignStarted',
          campaignId,
          definitionId: campaignDefinitionId('night-of-the-zealot'),
          difficulty: 'hard',
          investigators: [
            {
              code: investigatorCode('01001'),
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
          scenarioIds: [scenarioId('the-gathering'), scenarioId('the-midnight-masks')],
        },
        ...ending,
      ]);
      render(
        <MemoryRouter>
          <HomeScreen
            store={createAppStore(gameStore)}
            catalog={() => Promise.resolve(rolandCatalog)}
          />
        </MemoryRouter>,
      );

      const shelf = await screen.findByRole('list', { name: 'Your games' });

      expect(within(shelf).getByText('Campaign · Hard')).toBeTruthy();
      expect(within(shelf).getByRole('heading', { name: 'Night of the Zealot' })).toBeTruthy();
      expect(within(shelf).getByText('Zealot – Roland')).toBeTruthy();
      expect(within(shelf).getByText(standing)).toBeTruthy();
      expect(within(shelf).getByRole('link', { name: link }).getAttribute('href')).toBe(
        `/campaign/${campaignId}`,
      );
    },
  );

  it("shows a campaign's team as portraits from their card pictures", async () => {
    const roland = { ...rolandCatalog.investigators[0]!, imageSrc: '/bundles/cards/01001.png' };
    const gameStore = new IndexedDbStore(`home-test-${n++}`);
    const campaignId = await gameStore.createCampaign({ title: 'Zealot – Roland' });
    await gameStore.appendCampaignEvents(campaignId, [
      {
        type: 'CampaignStarted',
        campaignId,
        definitionId: campaignDefinitionId('night-of-the-zealot'),
        difficulty: 'hard',
        investigators: [
          {
            code: investigatorCode('01001'),
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
        scenarioIds: [scenarioId('the-gathering')],
      },
    ]);
    render(
      <MemoryRouter>
        <HomeScreen
          store={createAppStore(gameStore)}
          catalog={() => Promise.resolve({ ...rolandCatalog, investigators: [roland] })}
        />
      </MemoryRouter>,
    );

    const team = await screen.findByRole('list', { name: 'Investigators' });

    expect(within(team).getByText('Roland Banks')).toBeTruthy();
    await vi.waitFor(() =>
      expect(team.querySelector('img')?.getAttribute('src')).toBe(
        'https://arkhamdb.com/bundles/cards/01001.png',
      ),
    );
  });

  it('ribbons the cover played last and makes its button the brass primary', async () => {
    const gameStore = new IndexedDbStore(`home-test-${n++}`);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1_000);
    await gameStore.createGame({ title: 'Played first' });
    vi.setSystemTime(2_000);
    await gameStore.createGame({ title: 'Played last' });
    vi.useRealTimers();
    render(
      <MemoryRouter>
        <HomeScreen store={createAppStore(gameStore)} catalog={catalogLoading} />
      </MemoryRouter>,
    );

    const shelf = await screen.findByRole('list', { name: 'Your games' });
    const [last, first] = within(shelf).getAllByRole('listitem');

    expect(within(last!).getByText('Played last')).toBeTruthy();
    expect(within(last!).getByText('Last played')).toBeTruthy();
    expect(within(last!).getByRole('link', { name: 'Continue' }).hasAttribute('data-primary')).toBe(
      true,
    );
    expect(within(first!).queryByText('Last played')).toBeNull();
    expect(
      within(first!).getByRole('link', { name: 'Continue' }).hasAttribute('data-primary'),
    ).toBe(false);
  });

  it('shows a game of one scenario on a cover with its round and a way back in', async () => {
    await renderHome(['Night']);

    const shelf = await screen.findByRole('list', { name: 'Your games' });

    expect(within(shelf).getByText('One scenario')).toBeTruthy();
    expect(within(shelf).getByText('Night')).toBeTruthy();
    expect(within(shelf).getByText('Round 0, Setup')).toBeTruthy();
    expect(within(shelf).getByRole('link', { name: 'Continue' }).getAttribute('href')).toMatch(
      /^\/game\/.+/,
    );
  });

  it('renames a game from its menu', async () => {
    await renderHome(['Night']);

    fireEvent.click(await screen.findByRole('button', { name: 'More for Night' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Dawn' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Dawn')).toBeTruthy();
  });

  it('duplicates a game from its menu', async () => {
    await renderHome(['Night']);

    fireEvent.click(await screen.findByRole('button', { name: 'More for Night' }));
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));

    expect(await screen.findByText('Night (copy)')).toBeTruthy();
  });

  it('keeps the game when deleting is cancelled and removes it when confirmed', async () => {
    await renderHome(['Night']);

    fireEvent.click(await screen.findByRole('button', { name: 'More for Night' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Delete "Night"?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByText('Night')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'More for Night' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );

    expect(await screen.findByText('No games yet')).toBeTruthy();
  });

  /** Home over a stored Night of the Zealot campaign titled `title`, with its game of The Gathering. */
  async function renderCampaign(title: string) {
    const gameStore = new IndexedDbStore(`home-test-${n++}`);
    const campaignId = await gameStore.createCampaign({ title });
    await gameStore.appendCampaignEvents(campaignId, [
      {
        type: 'CampaignStarted',
        campaignId,
        definitionId: campaignDefinitionId('night-of-the-zealot'),
        difficulty: 'hard',
        investigators: [],
        chaosBag: ['0'],
        scenarioIds: [scenarioId('the-gathering')],
      },
    ]);
    await gameStore.createGame({ title: 'The Gathering', campaignId });
    render(
      <MemoryRouter>
        <HomeScreen store={createAppStore(gameStore)} catalog={catalogLoading} />
      </MemoryRouter>,
    );
    return gameStore;
  }

  it('renames a campaign from its menu', async () => {
    await renderCampaign('Zealot');

    fireEvent.click(await screen.findByRole('button', { name: 'More for Zealot' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
      target: { value: 'Zealot – Roland' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Zealot – Roland')).toBeTruthy();
  });

  it('warns that deleting a campaign takes its games along', async () => {
    await renderCampaign('Zealot');

    fireEvent.click(await screen.findByRole('button', { name: 'More for Zealot' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(
      within(screen.getByRole('alertdialog', { name: 'Delete "Zealot"?' })).getByText(
        'The campaign log and the games of its scenarios are removed from this device. This cannot be undone.',
      ),
    ).toBeTruthy();
  });

  it('deletes a campaign with its game once confirmed', async () => {
    const gameStore = await renderCampaign('Zealot');

    fireEvent.click(await screen.findByRole('button', { name: 'More for Zealot' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
    );

    expect(await screen.findByText('No games yet')).toBeTruthy();
    expect(await gameStore.listGames()).toEqual([]);
  });

  it('downloads an export of a campaign from its menu, named for the campaign', async () => {
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() });
    const downloaded: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloaded.push(this.download);
    });
    await renderCampaign('Zealot');

    fireEvent.click(await screen.findByRole('button', { name: 'More for Zealot' }));
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));

    await vi.waitFor(() => expect(downloaded).toEqual(['Zealot.arkham.json']));
  });

  it('downloads an export of a game from its menu', async () => {
    const createObjectURL = vi.fn(() => 'blob:test');
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await renderHome(['Night']);

    fireEvent.click(await screen.findByRole('button', { name: 'More for Night' }));
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));

    await vi.waitFor(() => expect(click).toHaveBeenCalled());
    expect(createObjectURL).toHaveBeenCalled();
    click.mockRestore();
  });

  it('imports an export file as a new game', async () => {
    await renderHome([]);
    const exported = {
      format: 'arkham-companion-game',
      stateVersion: STATE_VERSION,
      game: { title: 'Imported', createdAt: 1 },
      events: [],
    };
    const file = new File([JSON.stringify(exported)], 'game.json');

    fireEvent.change(await screen.findByLabelText('Load a saved game'), {
      target: { files: [file] },
    });

    expect(await screen.findByText('Imported')).toBeTruthy();
  });

  it('explains why a file from a newer version cannot be imported', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await renderHome([]);
    const file = new File([JSON.stringify({ stateVersion: STATE_VERSION + 1 })], 'game.json');

    fireEvent.change(await screen.findByLabelText('Load a saved game'), {
      target: { files: [file] },
    });

    expect((await screen.findByRole('alert')).textContent).toMatch(/newer version/);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('import'), expect.any(Error));
  });
});

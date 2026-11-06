// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { STATE_VERSION, campaignDefinitionId, investigatorCode, scenarioId } from '@arkham/engine';
import { initI18n } from '../i18n';
import { createAppStore } from '../state/appStore';
import { IndexedDbStore } from '../storage/IndexedDbStore';
import { HomeScreen } from './HomeScreen';

let n = 0;
async function renderHome(titles: string[]) {
  const gameStore = new IndexedDbStore(`home-test-${n++}`);
  for (const title of titles) await gameStore.createGame({ title });
  const store = createAppStore(gameStore);
  render(
    <MemoryRouter>
      <HomeScreen store={store} />
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
          <HomeScreen store={createAppStore(gameStore)} />
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

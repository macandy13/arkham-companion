import { expect, test, type Page } from './fixtures/test';
import { houseOpenedExport, resumeImportedGame } from './fixtures/saved_games';

/**
 * What the play screen shows of the game: the header's cards and piles, the status row, the map
 * and the investigators. The notices about the last step (what it drew or skipped) are left out:
 * they belong to the session that played it, not to the saved game.
 */
const shownGame = (page: Page) =>
  page
    .locator('#board > header, #board > #status, #board > #map, #board > #investigators')
    .allInnerTexts();

/** The phase the status row's phase track marks as the current one. */
const currentPhase = (page: Page) =>
  page.getByRole('list', { name: 'Phases' }).locator('[aria-current="step"]');

// Journey: play The Gathering on through two full rounds from Roland Banks' first turn, and reload
// the page in the middle of the mythos phase, the riskiest moment to lose the tab: the game comes
// back exactly as it was.
test('play two rounds and reload in the middle of the mythos phase', async ({ page }) => {
  await test.step('Resume the game on Roland Banks’ first turn, the house open', async () => {
    await resumeImportedGame(page, 'Two rounds', houseOpenedExport('Two rounds'));
    await expect(page.getByRole('heading', { name: 'Round 1' })).toBeVisible();
    await expect(currentPhase(page)).toHaveText('Investigation');
  });

  await test.step('End the turn and play on through the enemy and upkeep phases', async () => {
    await page.getByRole('button', { name: 'End turn' }).click();
    for (const phase of ['Enemy', 'Upkeep']) {
      await page.getByRole('button', { name: 'Next' }).click();
      await expect(currentPhase(page)).toHaveText(phase);
    }
  });

  await test.step('Start round 2 with its mythos phase', async () => {
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('heading', { name: 'Round 2' })).toBeVisible();
    await expect(currentPhase(page)).toHaveText('Mythos');
  });

  await test.step('Reload: the game comes back exactly as it was', async () => {
    const before = await shownGame(page);
    expect(before).toHaveLength(4);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Round 2' })).toBeVisible();
    await expect(currentPhase(page)).toHaveText('Mythos');
    expect(await shownGame(page)).toEqual(before);
  });

  await test.step('Play round 2: Roland Banks’ turn, then the enemy and upkeep phases', async () => {
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(currentPhase(page)).toHaveText('Investigation');
    await page.getByRole('button', { name: 'Start turn' }).click();
    await page.getByRole('button', { name: 'End turn' }).click();
    for (const phase of ['Enemy', 'Upkeep']) {
      await page.getByRole('button', { name: 'Next' }).click();
      await expect(currentPhase(page)).toHaveText(phase);
    }
  });

  await test.step('Round 3 begins', async () => {
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('heading', { name: 'Round 3' })).toBeVisible();
  });
});

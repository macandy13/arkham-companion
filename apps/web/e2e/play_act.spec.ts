import { expect, test } from './fixtures/test';
import { dragTo } from './fixtures/drag';
import {
  resumeImportedGame,
  studyCluesTakenExport,
  twoGhoulPriestsExport,
} from './fixtures/saved_games';

// Journey: The Barrier asks for its clues only as the round ends, from the investigators in the
// Hallway – in a game whose setup put two Ghoul Priests aside, so the act's reverse side cannot
// tell which one spawns and asks the players to do it by hand.
test('advance the act at the end of the round', async ({ page }) => {
  const act = page.getByRole('region', { name: 'Act' });

  await test.step('Import a game at act 2 with two Ghoul Priests set aside', async () => {
    await resumeImportedGame(page, 'Two Ghoul Priests', twoGhoulPriestsExport('Two Ghoul Priests'));
  });

  await test.step('Read the 3 clues Roland Banks holds in the Hallway on The Barrier, which has no Advance button', async () => {
    await expect(act.getByText('The Barrier')).toBeVisible();
    await expect(act.getByRole('img', { name: 'Clues 3 / 3' })).toBeVisible();
    await expect(act.getByRole('button', { name: 'Advance' })).toHaveCount(0);
  });

  await test.step('End the turn and play on through the enemy and upkeep phases', async () => {
    await page.getByRole('button', { name: 'End turn' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
    await page.getByRole('button', { name: 'Next' }).click();
  });

  await test.step('As the round ends, spend the clues and advance', async () => {
    await page.getByRole('button', { name: 'Spend the clues and advance' }).click();
    await expect(act.getByText('What Have You Done?')).toBeVisible();
  });

  await test.step('Read which effect to do by hand, then dismiss it', async () => {
    const notice = page.getByRole('status', { name: 'Do this by hand' });
    await expect(notice).toContainText(
      'The Barrier: spawning the enemy was skipped, as the game does not hold exactly one copy of Ghoul Priest.',
    );
    await notice.getByRole('button', { name: 'OK' }).click();
    await expect(notice).toBeHidden();
  });
});

// Journey: advance act 1 by dragging one of Roland Banks' clues onto it, as its button would.
test('advance the act by dragging a clue onto it', async ({ page }) => {
  const act = page.getByRole('region', { name: 'Act' });

  await test.step("Import a game on Roland Banks' first turn, holding the 2 clues Trapped needs", async () => {
    await resumeImportedGame(page, 'Study clues', studyCluesTakenExport('Study clues'));
    await expect(act.getByRole('img', { name: 'Clues 2 / 2' })).toBeVisible();
  });

  await test.step("Drag a clue off Roland Banks' card onto Trapped", async () => {
    await dragTo(
      page,
      page.getByRole('region', { name: 'Roland Banks' }).locator('[data-drag="clues"]'),
      act,
    );
    await expect(act.getByText('The Barrier')).toBeVisible();
  });
});

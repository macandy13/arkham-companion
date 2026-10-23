import { expect, test } from './fixtures/test';
import { resumeImportedGame, twoGhoulPriestsExport } from './fixtures/saved_games';

// Journey: advance the act once the investigators hold its clues – in a game whose setup put two
// Ghoul Priests aside, so the act's reverse side cannot tell which one spawns and asks the players
// to do it by hand.
test('advance the act', { tag: '@flow' }, async ({ page }) => {
  await test.step('Import a game at act 2 with two Ghoul Priests set aside', async () => {
    await resumeImportedGame(page, 'Two Ghoul Priests', twoGhoulPriestsExport('Two Ghoul Priests'));
  });

  await test.step('Advance The Barrier with the 3 clues Alder holds', async () => {
    const act = page.getByRole('region', { name: 'Act' });
    await expect(act.getByText('The Barrier')).toBeVisible();
    await expect(act.getByText('Clues 3 / 3')).toBeVisible();
    await act.getByRole('button', { name: 'Advance' }).click();
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

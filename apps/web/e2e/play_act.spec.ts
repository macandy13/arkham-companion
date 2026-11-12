import { expect, test } from './fixtures/test';
import { dragTo } from './fixtures/drag';
import {
  naomiInPlayExport,
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
    await expect(act.getByRole('button', { name: 'Advance', exact: true })).toHaveCount(0);
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

// Journey: an objective the app leaves to the players. They advance Trapped by hand from its full
// card, then end the scenario from the menu with the resolution they reached at the table, and the
// resolution dialog opens on it as after any other ending.
test('advance the act by hand and end the scenario with a resolution', async ({ page }) => {
  const act = page.getByRole('region', { name: 'Act' });

  await test.step('Import a game on act 1, Trapped', async () => {
    await resumeImportedGame(page, 'By hand', studyCluesTakenExport('By hand'));
    await expect(act.getByText('Trapped')).toBeVisible();
  });

  await test.step('Advance Trapped by hand from its full card, confirming it', async () => {
    await act.getByRole('button', { name: 'Trapped' }).click();
    await page
      .getByRole('dialog', { name: 'Trapped' })
      .getByRole('button', { name: 'Advance by hand' })
      .click();
    const confirm = page.getByRole('alertdialog', { name: 'Advance Trapped by hand?' });
    await confirm.getByRole('button', { name: 'Advance by hand' }).click();
    await expect(act.getByText('The Barrier')).toBeVisible();
  });

  await test.step('End the scenario from the menu with Resolution 2', async () => {
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('button', { name: 'End the scenario' }).click();
    const end = page.getByRole('alertdialog', { name: 'End the scenario with which resolution?' });
    await end.getByRole('radio', { name: 'Resolution 2' }).check();
    await end.getByRole('button', { name: 'End the scenario' }).click();
  });

  await test.step('The resolution dialog opens on Resolution 2', async () => {
    const dialog = page.locator('#resolution');
    await expect(dialog.getByRole('heading', { name: 'The scenario is over' })).toBeVisible();
    await expect(dialog.getByRole('radio', { name: 'Resolution 2 from the game' })).toBeChecked();
  });
});

// Journey: Smoke and Mirrors. Naomi O'Bannion's codex entry says she is interrogated, so the players
// put her beneath Augurs of Flame from her card, where she lies fanned at the act's corner.
test('put an interrogated suspect beneath the act', async ({ page }) => {
  const naomi = page.getByRole('img', { name: /^Naomi O'Bannion/ }).first();
  const act = page.getByRole('region', { name: 'Act' });

  await test.step("Import a game of Smoke and Mirrors with Naomi O'Bannion in play, nothing beneath the act yet", async () => {
    await resumeImportedGame(page, 'Interrogation', naomiInPlayExport('Interrogation'));
    await expect(naomi).toBeVisible();
    await expect(act.getByRole('button', { name: /^Beneath the act/ })).toHaveCount(0);
  });

  await test.step('Put her beneath the act from her card', async () => {
    await naomi.click();
    await page
      .getByRole('dialog', { name: "Naomi O'Bannion" })
      .getByRole('button', { name: 'Put beneath the act' })
      .click();
    await expect(page.getByRole('img', { name: /^Naomi O'Bannion/ })).toHaveCount(0);
  });

  await test.step('She lies fanned at the act, and a tap there shows her', async () => {
    await act.getByRole('button', { name: 'Beneath the act, 1 card' }).click();
    const pile = page.getByRole('dialog', { name: 'Beneath the act (1)' });
    await expect(pile.getByRole('region', { name: "Naomi O'Bannion" })).toBeVisible();
  });
});

import { expect, test } from '@playwright/test';
import { stubArkhamDb } from './fixtures/arkhamdb';
import { startQuickGame } from './fixtures/wizard';

test.beforeEach(async ({ page }) => {
  await stubArkhamDb(page);
});

// Home flow: the production build boots, hash routes resolve, a new game survives a reload and
// the home screen manages the saved games. Not a `@flow` spec any more: the home screen has been
// reviewed, so it no longer needs a screencast on every PR.
test('a new game survives reload and is managed from the home screen', async ({ page }) => {
  const before = await test.step('Open the game list', async () => {
    await page.goto('/');
    await expect(page).toHaveTitle('Arkham Companion');
    await expect(page.getByRole('heading', { level: 1, name: 'Games' })).toBeVisible();
    return page.getByRole('list', { name: 'Games' }).getByRole('listitem').count();
  });

  await test.step('Start a quick game', async () => {
    await page.getByRole('link', { name: /new game/i }).click();
    await expect(page).toHaveURL(/#\/new$/);
    await startQuickGame(page);
  });

  await test.step('Reload the game', async () => {
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  await test.step('The new game is listed', async () => {
    await page.getByRole('link', { name: 'Arkham Companion' }).click();
    await expect(page.getByRole('list', { name: 'Games' }).getByRole('listitem')).toHaveCount(
      before + 1,
    );
  });

  const games = page.getByRole('list', { name: 'Games' });

  await test.step('Rename the game', async () => {
    await page.getByRole('button', { name: 'Rename' }).click();
    await page.getByRole('textbox', { name: 'Name' }).fill('Night of the Test');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(games.getByRole('link', { name: 'Night of the Test' }).first()).toBeVisible();
  });

  await test.step('Duplicate the game', async () => {
    await page.getByRole('button', { name: 'Duplicate' }).click();
    await expect(games.getByRole('listitem')).toHaveCount(before + 2);
    await expect(
      games.getByRole('link', { name: 'Night of the Test (copy)' }).first(),
    ).toBeVisible();
  });

  await test.step('Delete the copy', async () => {
    const copy = games.getByRole('listitem').filter({ hasText: 'Night of the Test (copy)' });
    await copy.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await expect(games.getByRole('listitem')).toHaveCount(before + 1);
  });

  await test.step('Resume the game from the list', async () => {
    await games.getByRole('link', { name: 'Resume' }).click();
    await expect(page).toHaveURL(/#\/game\/.+/);
  });
});

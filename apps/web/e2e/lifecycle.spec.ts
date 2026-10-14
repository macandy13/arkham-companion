import { expect, startQuickGame, test } from './fixtures';

// Core lifecycle on a tablet: pick investigators, start the sandbox scenario, close the tab, resume, delete.
test('a game is started with two investigators, resumed after a reload and deleted', async ({
  page,
}) => {
  await page.goto('/');
  await startQuickGame(page);
  const gameUrl = page.url();

  await page.reload();
  await expect(page).toHaveURL(gameUrl);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await page.goto('/');
  const games = page.getByRole('list', { name: 'Games' });
  const game = games.getByRole('listitem');
  await expect(game).toHaveCount(1);
  await expect(game).toContainText('Alder, Birch');

  await game.getByRole('link', { name: 'Resume' }).click();
  await expect(page).toHaveURL(gameUrl);

  await page.goto('/');
  await game.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
  await expect(games).toHaveCount(0);

  await page.reload();
  await expect(games).toHaveCount(0);
});

test('cancelling the delete confirmation keeps the game', async ({ page }) => {
  await page.goto('/');
  await startQuickGame(page);
  await page.goto('/');

  const game = page.getByRole('list', { name: 'Games' }).getByRole('listitem');
  await game.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();
  await expect(game).toHaveCount(1);
});

import { expect, test } from './fixtures/test';
import { startQuickGame } from './fixtures/wizard';

// Journey: the whole life of a saved game on a tablet – start it, close the tab, resume it, keep it
// tidy (rename, duplicate, delete with confirmation) and back it up (export, import). It doubles as
// the smoke test: it boots the production build and resolves the hash routes.
test('a game is started, resumed, managed and backed up', { tag: '@flow' }, async ({ page }) => {
  const games = page.getByRole('list', { name: 'Games' });
  const items = games.getByRole('listitem');
  const named = (title: string) =>
    items.filter({ has: page.getByRole('link', { name: title, exact: true }) });
  let gameUrl = '';

  await test.step('Open the game list', async () => {
    await page.goto('/');
    await expect(page).toHaveTitle('Arkham Companion');
    await expect(page.getByRole('heading', { level: 1, name: 'Games' })).toBeVisible();
    await expect(items).toHaveCount(0);
  });

  await test.step('Start a quick game with two investigators', async () => {
    await page.getByRole('link', { name: 'New game' }).click();
    await expect(page).toHaveURL(/#\/new$/);
    await startQuickGame(page, ['Fake Guardian', 'Fake Seeker']);
    gameUrl = page.url();
  });

  await test.step('Reload the game', async () => {
    await page.reload();
    await expect(page).toHaveURL(gameUrl);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  await test.step('The game is listed with its investigators', async () => {
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('link', { name: 'All games' }).click();
    await expect(items).toHaveCount(1);
    await expect(items).toContainText('Fake Guardian, Fake Seeker');
  });

  await test.step('Resume the game from the list', async () => {
    await items.getByRole('link', { name: 'Resume' }).click();
    await expect(page).toHaveURL(gameUrl);
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('link', { name: 'All games' }).click();
  });

  await test.step('Rename the game', async () => {
    await items.getByRole('button', { name: 'Rename' }).click();
    await page.getByRole('textbox', { name: 'Name' }).fill('Night of the Test');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(named('Night of the Test')).toBeVisible();
  });

  await test.step('Duplicate the game', async () => {
    await items.getByRole('button', { name: 'Duplicate' }).click();
    await expect(items).toHaveCount(2);
    await expect(named('Night of the Test (copy)')).toBeVisible();
  });

  const backup = await test.step('Export the game to a file', async () => {
    const download = page.waitForEvent('download');
    await named('Night of the Test').getByRole('button', { name: 'Export' }).click();
    const chunks: Buffer[] = [];
    for await (const chunk of await (await download).createReadStream()) {
      chunks.push(chunk as Buffer);
    }
    return Buffer.concat(chunks);
  });

  await test.step('Import the file as a new game', async () => {
    await page.getByLabel('Import game').setInputFiles({
      name: 'game.arkham.json',
      mimeType: 'application/json',
      buffer: backup,
    });
    await expect(items).toHaveCount(3);
  });

  await test.step('Cancel deleting a game: it stays', async () => {
    await named('Night of the Test (copy)').getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();
    await expect(items).toHaveCount(3);
  });

  await test.step('Delete the copy', async () => {
    await named('Night of the Test (copy)').getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await expect(items).toHaveCount(2);
  });

  await test.step('The remaining games survive a reload', async () => {
    await page.reload();
    await expect(items).toHaveCount(2);
  });
});

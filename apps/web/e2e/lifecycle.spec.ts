import { expect, test } from './fixtures/test';
import { seatQuickGame } from './fixtures/wizard';

// Journey: the whole life of a saved game on a tablet – start it, close the tab, resume it, keep it
// tidy from its cover's menu (rename, duplicate, delete with confirmation) and back it up (export,
// import). It doubles as the smoke test: it boots the production build and resolves the hash routes.
test('a game is started, resumed, managed and backed up', async ({ page }) => {
  const items = page.getByRole('list', { name: 'Your games' }).locator(':scope > li');
  const named = (title: string) => items.filter({ has: page.getByText(title, { exact: true }) });
  const choose = async (title: string, action: string) => {
    await page.getByRole('button', { name: `More for ${title}`, exact: true }).click();
    await page.getByRole('button', { name: action, exact: true }).click();
  };
  let gameUrl = '';

  await test.step('Open the game list', async () => {
    await page.goto('/');
    await expect(page).toHaveTitle('Arkham Companion');
    await expect(page.getByRole('heading', { level: 1, name: 'Arkham Companion' })).toBeVisible();
    await expect(items).toHaveCount(0);
  });

  await test.step('Start a quick game with two investigators', async () => {
    await page.getByRole('link', { name: 'One scenario' }).click();
    await expect(page).toHaveURL(/#\/new\?mode=quick$/);
    await seatQuickGame(page, ['Fake Guardian', 'Fake Seeker']);
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
    await expect(
      items.getByRole('list', { name: 'Investigators' }).getByRole('listitem'),
    ).toHaveText(['Fake Guardian', 'Fake Seeker']);
  });

  await test.step('Resume the game from the list', async () => {
    await items.getByRole('link', { name: 'Continue' }).click();
    await expect(page).toHaveURL(gameUrl);
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('link', { name: 'All games' }).click();
  });

  await test.step('Rename the game', async () => {
    await items.getByRole('button', { name: /^More for / }).click();
    await page.getByRole('button', { name: 'Rename', exact: true }).click();
    await page.getByRole('textbox', { name: 'Name' }).fill('Night of the Test');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(named('Night of the Test')).toBeVisible();
  });

  await test.step('Duplicate the game', async () => {
    await choose('Night of the Test', 'Duplicate');
    await expect(items).toHaveCount(2);
    await expect(named('Night of the Test (copy)')).toBeVisible();
  });

  const backup = await test.step('Export the game to a file', async () => {
    const download = page.waitForEvent('download');
    await choose('Night of the Test', 'Export');
    const chunks: Buffer[] = [];
    for await (const chunk of await (await download).createReadStream()) {
      chunks.push(chunk as Buffer);
    }
    return Buffer.concat(chunks);
  });

  await test.step('Import the file as a new game', async () => {
    await page.getByLabel('Load a saved game').setInputFiles({
      name: 'game.arkham.json',
      mimeType: 'application/json',
      buffer: backup,
    });
    await expect(items).toHaveCount(3);
  });

  await test.step('Cancel deleting a game: it stays', async () => {
    await choose('Night of the Test (copy)', 'Delete');
    await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();
    await expect(items).toHaveCount(3);
  });

  await test.step('Delete the copy', async () => {
    await choose('Night of the Test (copy)', 'Delete');
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await expect(items).toHaveCount(2);
  });

  await test.step('The remaining games survive a reload', async () => {
    await page.reload();
    await expect(items).toHaveCount(2);
  });
});

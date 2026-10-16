import { expect, test } from '@playwright/test';
import { stubArkhamDb } from './fixtures/arkhamdb';
import { startQuickGame } from './fixtures/wizard';

test.beforeEach(async ({ page }) => {
  await stubArkhamDb(page);
});

// Journey: back up a saved game to a file and restore it as a new game from the home screen.
test('back up and restore a game', { tag: '@flow' }, async ({ page }) => {
  const games = page.getByRole('list', { name: 'Games' });

  await test.step('Start a quick game', async () => {
    await page.goto('/#/new');
    await startQuickGame(page);
  });

  const before = await test.step('Open the game list', async () => {
    await page.getByRole('link', { name: 'Arkham Companion' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Games' })).toBeVisible();
    return games.getByRole('listitem').count();
  });

  const backup = await test.step('Export the game to a file', async () => {
    const download = page.waitForEvent('download');
    await games.getByRole('listitem').first().getByRole('button', { name: 'Export' }).click();
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
    await expect(games.getByRole('listitem')).toHaveCount(before + 1);
  });

  await test.step('Resume the imported game', async () => {
    await games.getByRole('link', { name: 'Resume' }).first().click();
    await expect(page).toHaveURL(/#\/game\/.+/);
  });
});

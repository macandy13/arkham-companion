import { expect, test } from '@playwright/test';

// Smoke test: the production build boots, hash routes resolve, and a new game survives a reload.
// Fuller flows arrive with M2.8 and M3.9.
test('app boots and a new game survives reload', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Arkham Companion');
  await expect(page.getByRole('heading', { level: 1, name: 'Games' })).toBeVisible();

  const games = page.getByRole('list', { name: 'Games' });
  const before = await games.getByRole('listitem').count();
  await page.getByRole('link', { name: /new game/i }).click();
  await expect(page).toHaveURL(/#\/new$/);
  await page.getByRole('button', { name: /create empty game/i }).click();
  await expect(page).toHaveURL(/#\/game\/.+/);

  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await page.getByRole('link', { name: 'Arkham Companion' }).click();
  await expect(page.getByRole('list', { name: 'Games' }).getByRole('listitem')).toHaveCount(
    before + 1,
  );
});

test('an exported game can be imported as a new game', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /new game/i }).click();
  await page.getByRole('button', { name: /create empty game/i }).click();
  await page.getByRole('link', { name: 'Arkham Companion' }).click();

  const games = page.getByRole('list', { name: 'Games' }).getByRole('listitem');
  const before = await games.count();
  const download = page.waitForEvent('download');
  await games.first().getByRole('button', { name: 'Export' }).click();
  const chunks: Buffer[] = [];
  for await (const chunk of await (await download).createReadStream()) {
    chunks.push(chunk as Buffer);
  }

  await page.getByLabel('Import game').setInputFiles({
    name: 'game.arkham.json',
    mimeType: 'application/json',
    buffer: Buffer.concat(chunks),
  });
  await expect(games).toHaveCount(before + 1);
});

test('deep links to settings work', async ({ page }) => {
  await page.goto('/#/settings');
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
});

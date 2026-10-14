import { expect, startQuickGame, test } from './fixtures';

// Smoke test: the production build boots, hash routes resolve, and a new game survives a reload.
// The full game lifecycle is in lifecycle.spec.ts.
test('app boots and a new game survives reload', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Arkham Companion');
  await expect(page.getByRole('heading', { level: 1, name: 'Games' })).toBeVisible();

  const games = page.getByRole('list', { name: 'Games' });
  const before = await games.getByRole('listitem').count();
  await page.getByRole('link', { name: /new game/i }).click();
  await expect(page).toHaveURL(/#\/new$/);
  await startQuickGame(page);

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
  await startQuickGame(page);
  await page.getByRole('link', { name: 'Arkham Companion' }).click();

  const games = page.getByRole('list', { name: 'Games' }).getByRole('listitem');
  await expect(games.first()).toBeVisible();
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

test('the wizard keeps its choices over a reload and when going back', async ({ page }) => {
  await page.goto('/#/new?mode=campaign');
  await page.getByRole('radio', { name: 'Expert' }).check();
  await page.getByRole('button', { name: 'Next' }).click();
  await page
    .getByRole('list', { name: 'Investigators' })
    .getByRole('button', { name: 'Birch' })
    .click();
  await page.getByRole('button', { name: 'Select' }).click();

  await page.reload();
  await expect(page.getByRole('region', { name: 'Seats' })).toContainText('Birch');
  await page.goBack();

  await expect(page.getByRole('radio', { name: 'Expert' })).toBeChecked();
});

test('deep links to settings work', async ({ page }) => {
  await page.goto('/#/settings');
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
});

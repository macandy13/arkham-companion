import { expect, test } from '@playwright/test';
import { stubArkhamDb } from './fixtures/arkhamdb';

test.beforeEach(async ({ page }) => {
  await stubArkhamDb(page);
});

// Smoke test: the production build boots, hash routes resolve, and a new game survives a reload.
// Fuller flows arrive with M2.8 and M3.9. `@flow` specs are also recorded for PR screencasts;
// their `test.step` names become the captions in the recording.
test('app boots and a new game survives reload', { tag: '@flow' }, async ({ page }) => {
  const before = await test.step('Open the game list', async () => {
    await page.goto('/');
    await expect(page).toHaveTitle('Arkham Companion');
    await expect(page.getByRole('heading', { level: 1, name: 'Games' })).toBeVisible();
    return page.getByRole('list', { name: 'Games' }).getByRole('listitem').count();
  });

  await test.step('Create an empty game', async () => {
    await page.getByRole('link', { name: /new game/i }).click();
    await expect(page).toHaveURL(/#\/new$/);
    await page.getByRole('button', { name: /create empty game/i }).click();
    await expect(page).toHaveURL(/#\/game\/.+/);
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
});

test('deep links to settings work', async ({ page }) => {
  await page.goto('/#/settings');
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
});

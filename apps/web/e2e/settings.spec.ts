import { expect, test } from '@playwright/test';
import { stubArkhamDb } from './fixtures/arkhamdb';

test.beforeEach(async ({ page }) => {
  await stubArkhamDb(page);
});

// Journey: change the preferences and see the app react. Pack ownership joins in once the
// settings screen receives the catalog packs (M2.7).
test('change the settings', { tag: '@flow' }, async ({ page }) => {
  await test.step('Open the settings', async () => {
    await page.goto('/#/settings');
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Card language' })).toHaveValue('en');
  });

  await test.step('Switch the card language to German', async () => {
    await page.getByRole('combobox', { name: 'Card language' }).selectOption({ label: 'Deutsch' });
    await expect(page.getByRole('combobox', { name: 'Card language' })).toHaveValue('de');
  });

  await test.step('Switch the app language to German', async () => {
    await page.getByRole('combobox', { name: 'App language' }).selectOption({ label: 'Deutsch' });
    await expect(page.getByRole('heading', { level: 1, name: 'Einstellungen' })).toBeVisible();
  });

  await test.step('Switch to the light theme', async () => {
    await page.getByRole('combobox', { name: 'Design' }).selectOption({ label: 'Hell' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  await test.step('The settings survive a reload', async () => {
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Einstellungen' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.getByRole('combobox', { name: 'Kartensprache' })).toHaveValue('de');
  });
});

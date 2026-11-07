import { expect, test } from './fixtures/test';

// Journey: change the preferences and see the app react.
test('change the settings', async ({ page }) => {
  await test.step('Open the settings', async () => {
    await page.goto('/#/settings');
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Card language' })).toHaveValue('en');
  });

  await test.step('Tick a box on the collection page and go back', async () => {
    await page.getByRole('link', { name: /campaign/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Your collection' })).toBeVisible();
    await page.getByRole('checkbox', { name: 'Core Set', exact: true }).check();
    await page.getByRole('link', { name: 'Back' }).click();
    await expect(page.getByRole('link', { name: /campaign/ })).toContainText('Core Set');
  });

  await test.step('Switch the card language to German', async () => {
    await page.getByRole('combobox', { name: 'Card language' }).selectOption({ label: 'Deutsch' });
    await expect(page.getByRole('combobox', { name: 'Card language' })).toHaveValue('de');
  });

  await test.step('Switch the app language to German', async () => {
    await page.getByRole('combobox', { name: 'App language' }).selectOption({ label: 'Deutsch' });
    await expect(page.getByRole('heading', { level: 1, name: 'Einstellungen' })).toBeVisible();
  });

  await test.step('Lay the table by day', async () => {
    await page.getByRole('radio', { name: 'Bei Tag' }).check();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  await test.step('The settings survive a reload', async () => {
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Einstellungen' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.getByRole('combobox', { name: 'Kartensprache' })).toHaveValue('de');
  });
});

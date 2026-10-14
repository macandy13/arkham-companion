import { expect, test } from '@playwright/test';

// Smoke test: the production build boots, renders the shell, and a new game survives a reload.
// Fuller flows arrive with M2.8 and M3.9.
test('app boots and a new game survives reload', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Arkham Companion');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  const games = page.getByRole('complementary');
  const before = await games.getByRole('listitem').count();
  await page.getByRole('button', { name: /new game/i }).click();
  await expect(games.getByRole('listitem')).toHaveCount(before + 1);

  await page.reload();
  await expect(games.getByRole('listitem')).toHaveCount(before + 1);
});

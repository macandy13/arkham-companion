import { expect, type Page } from '@playwright/test';

/**
 * Runs the quick-game wizard from the `/new` landing page, seating the named investigators of the
 * invented catalog in order, and ends on the game route. Flows that only need "a started game"
 * use it; the wizard's own journey is spelled out step by step in `new_game.spec.ts`.
 */
export async function startQuickGame(
  page: Page,
  investigators: readonly string[] = ['Fake Seeker'],
): Promise<void> {
  await page.getByRole('link', { name: 'Quick game' }).first().click();
  await page.getByRole('button', { name: 'Next' }).click();
  for (const name of investigators) {
    await page.getByRole('list', { name: 'Investigators' }).getByRole('button', { name }).click();
    await page.getByRole('button', { name: 'Select', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(page).toHaveURL(/#\/game\/.+/);
}

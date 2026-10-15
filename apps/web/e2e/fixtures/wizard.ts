import { expect, type Page } from '@playwright/test';

/**
 * Runs the quick-game wizard from the `/new` landing page with the stubbed catalog's Fake Seeker
 * and ends on the game route. Flows that only need "a started game" use it; the wizard's own
 * journey is spelled out step by step in `new_game.spec.ts`.
 */
export async function startQuickGame(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'Quick game' }).first().click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page
    .getByRole('list', { name: 'Investigators' })
    .getByRole('button', { name: /Fake Seeker/ })
    .click();
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(page).toHaveURL(/#\/game\/.+/);
}

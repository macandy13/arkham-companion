import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/test';
import {
  houseOpenedExport,
  investigationOpenExport,
  resumeImportedGame,
} from './fixtures/saved_games';

/** The axe violations on the page as it stands, by rule, with the elements that break it. */
async function violations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) }));
}

// Each main screen passes an automated accessibility check (WCAG 2.1 A and AA): names, roles and
// the structure screen readers read (M6.5c). Axe cannot measure contrast over the table's and the
// paper's gradients, so `src/styles/contrast.test.ts` checks the text colours' tokens instead.

test('the home screen', async ({ page }) => {
  await page.goto('/#/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  expect(await violations(page)).toEqual([]);
});

test('the new game wizard', async ({ page }) => {
  await page.goto('/#/new');
  await expect(page.getByRole('link', { name: 'New campaign' })).toBeVisible();

  expect(await violations(page)).toEqual([]);
});

test('the settings', async ({ page }) => {
  await page.goto('/#/settings');
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();

  expect(await violations(page)).toEqual([]);
});

test('the game screen', async ({ page }) => {
  await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));
  await expect(page.getByRole('figure', { name: 'House' })).toBeVisible();

  expect(await violations(page)).toEqual([]);
});

test('the game screen with its menu open', async ({ page }) => {
  await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));
  await page.getByRole('button', { name: 'Menu' }).click();

  expect(await violations(page)).toEqual([]);
});

test('a decision dialog with a token drawn', async ({ page }) => {
  await resumeImportedGame(page, 'Investigating', investigationOpenExport('Investigating'));
  const decision = page.getByRole('dialog', { name: 'Investigate Hallway' });
  await decision.getByRole('button', { name: 'Draw a token' }).click();
  await expect(decision.getByRole('status')).toBeVisible();

  expect(await violations(page)).toEqual([]);
});

test('the campaign log', async ({ page }) => {
  await page.goto('/#/new');
  await page.getByRole('link', { name: 'New campaign' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: /Fake Seeker/ }).click();
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(page).toHaveURL(/#\/game\/.+/);
  await page.goto('/#/');
  await page.getByRole('button', { name: /^More for / }).click();
  await page.getByRole('button', { name: 'Read the log' }).click();
  await expect(page.getByRole('region', { name: 'Scenarios' })).toBeVisible();

  expect(await violations(page)).toEqual([]);
});

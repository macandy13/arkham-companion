import { expect, test } from '@playwright/test';
import { stubArkhamDb } from './fixtures/arkhamdb';

test.beforeEach(async ({ page }) => {
  await stubArkhamDb(page);
});

// Journey: start a new game and seat an investigator. Later milestones extend it up to the
// started game (wizard, M2.5).
test('start a new game', { tag: '@flow' }, async ({ page }) => {
  const portraits = page.getByRole('list', { name: 'Investigators' });

  await test.step('Open the new game screen', async () => {
    await page.goto('/#/new');
    await expect(portraits.getByRole('listitem')).toHaveCount(2);
  });

  await test.step('Search for an investigator by name', async () => {
    await page.getByRole('searchbox', { name: 'Search by name' }).fill('guardian');
    await expect(portraits.getByRole('listitem')).toHaveCount(1);
    await expect(portraits).toContainText('Fake Guardian');
  });

  await test.step('Filter by class', async () => {
    await page.getByRole('searchbox', { name: 'Search by name' }).clear();
    await page.getByRole('button', { name: 'Seeker', exact: true }).click();
    await expect(portraits.getByRole('listitem')).toHaveCount(1);
    await expect(portraits).toContainText('Fake Seeker');
  });

  await test.step('Pick the investigator', async () => {
    await page.getByRole('button', { name: /Fake Seeker/ }).click();
    await page.getByRole('button', { name: 'Select', exact: true }).click();
  });

  await test.step('The investigator takes the first seat', async () => {
    const seats = page.getByRole('region', { name: 'Seats' });
    await expect(seats.getByRole('listitem')).toHaveCount(1);
    await expect(seats).toContainText('Fake Seeker');
  });
});

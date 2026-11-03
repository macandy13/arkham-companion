import { expect, test } from '../fixtures/test';
import {
  fakeGuardian,
  fakeSeeker,
  gatheringKilledEvents,
  openStoredCampaign,
  rolandBanks,
} from '../fixtures/saved_campaigns';

// The setup preview after The Gathering killed Fake Seeker (`@shot`, coding guidelines §3).

test('the replacement picker for the killed Fake Seeker', async ({ page }) => {
  await openStoredCampaign(page, 'Zealot – Fake Seeker', (id) =>
    gatheringKilledEvents(id, [fakeSeeker], fakeSeeker),
  );
  await page.getByRole('button', { name: 'Set up The Midnight Masks' }).click();
  await page.getByRole('button', { name: 'Choose a replacement for Fake Seeker' }).click();

  const picker = page.getByRole('dialog', { name: 'Replace Fake Seeker' });
  await expect(picker.getByRole('button', { name: /Fake Guardian/ })).toBeVisible();
  await expect(picker.getByRole('button', { name: /Fake Seeker/ })).toHaveCount(0);
});

test('the setup preview with Roland Banks replacing Fake Seeker', async ({ page }) => {
  await openStoredCampaign(page, 'Zealot – Fake Seeker', (id) =>
    gatheringKilledEvents(id, [fakeSeeker], fakeSeeker),
  );
  await page.getByRole('button', { name: 'Set up The Midnight Masks' }).click();
  await page.getByRole('button', { name: 'Choose a replacement for Fake Seeker' }).click();
  const picker = page.getByRole('dialog', { name: 'Replace Fake Seeker' });
  await picker.getByRole('button', { name: /Roland Banks/ }).click();
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  await picker.getByRole('button', { name: 'Choose' }).click();

  const preview = page.getByRole('dialog', { name: 'Set up The Midnight Masks' });
  await expect(preview).toContainText('Roland Banks takes their place.');
  await expect(preview.getByRole('button', { name: 'Start game' })).toBeEnabled();
});

test('the setup preview with nobody left to replace Fake Seeker', async ({ page }) => {
  await openStoredCampaign(page, 'Zealot – everyone', (id) =>
    gatheringKilledEvents(id, [fakeSeeker, fakeGuardian, rolandBanks], fakeSeeker),
  );
  await page.getByRole('button', { name: 'Set up The Midnight Masks' }).click();

  const preview = page.getByRole('dialog', { name: 'Set up The Midnight Masks' });
  await expect(preview).toContainText(
    'No investigator is left to choose: the campaign is over and the players lose.',
  );
  await expect(preview.getByRole('button', { name: 'Start game' })).toBeDisabled();
});

test('the log of a campaign lost for want of investigators', async ({ page }) => {
  await openStoredCampaign(page, 'Zealot – everyone', (id) =>
    gatheringKilledEvents(id, [fakeSeeker, fakeGuardian, rolandBanks], fakeSeeker),
  );
  await page.getByRole('button', { name: 'Set up The Midnight Masks' }).click();
  await page.getByRole('button', { name: 'End the campaign' }).click();

  await expect(page.getByText('The campaign ends: the investigators lost.')).toBeVisible();
});

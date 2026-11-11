import { expect, test } from '../fixtures/test';
import { fakeSeeker, gatheringKilledEvents, openStoredCampaign } from '../fixtures/saved_campaigns';

// The setup preview after The Gathering killed Fake Seeker (coding guidelines §3).

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

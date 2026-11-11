import { expect, test } from '../fixtures/test';
import { openStoredCampaign, rolandBanks, zealotWonEvents } from '../fixtures/saved_campaigns';

// How a campaign's log reads once the campaign is over (coding guidelines §3).

test('the log of Night of the Zealot, won', async ({ page }) => {
  await openStoredCampaign(page, 'Zealot – Roland Banks', (id) =>
    zealotWonEvents(id, [rolandBanks]),
  );

  await expect(page.getByRole('region', { name: 'Campaign over' })).toContainText('Won');
  await expect(
    page.getByText('Read Resolution 1 of The Devourer Below in the campaign guide.'),
  ).toBeVisible();
});

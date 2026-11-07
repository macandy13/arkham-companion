import { expect, test } from './fixtures/test';
import {
  fakeSeeker,
  gatheringKilledEvents,
  openStoredCampaign,
  rolandBanks,
} from './fixtures/saved_campaigns';

// Journey: a campaign is backed up from its cover's menu, deleted, and loaded back from the file,
// where it stands as before.
test('a campaign is exported, deleted and loaded back', async ({ page }) => {
  const covers = page.getByRole('list', { name: 'Your games' }).locator(':scope > li');
  const choose = async (action: string) => {
    await page.getByRole('button', { name: 'More for Sunday with Kim', exact: true }).click();
    await page.getByRole('button', { name: action, exact: true }).click();
  };

  await test.step('Open home with a campaign after The Gathering', async () => {
    await openStoredCampaign(page, 'Sunday with Kim', (id) =>
      gatheringKilledEvents(id, [rolandBanks, fakeSeeker], fakeSeeker),
    );
    await page.goto('/#/');
    await expect(covers).toHaveCount(1);
  });

  const backup = await test.step('Export the campaign to a file', async () => {
    const download = page.waitForEvent('download');
    await choose('Export');
    expect((await download).suggestedFilename()).toBe('Sunday-with-Kim.arkham.json');
    const chunks: Buffer[] = [];
    for await (const chunk of await (await download).createReadStream()) {
      chunks.push(chunk as Buffer);
    }
    return Buffer.concat(chunks);
  });

  await test.step('Delete the campaign', async () => {
    await choose('Delete');
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText(/stay on the table/)).toBeVisible();
  });

  await test.step('Load the file: the campaign is back where it stood', async () => {
    await page.getByLabel('Load a saved game').setInputFiles({
      name: 'Sunday-with-Kim.arkham.json',
      mimeType: 'application/json',
      buffer: backup,
    });
    await expect(covers).toHaveCount(1);
    await expect(covers).toContainText('Sunday with Kim');
    await expect(page.getByRole('link', { name: 'Set up chapter 2' })).toBeVisible();
  });
});

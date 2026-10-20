import { expect, test } from './fixtures/test';
import { startQuickGame } from './fixtures/wizard';

// Journey: open a new game and read the map it starts on, with its locations at their places.
test('read the starting map', { tag: '@flow' }, async ({ page }) => {
  await test.step('Start a quick game', async () => {
    await page.goto('/#/new');
    await startQuickGame(page);
    await expect(page.getByText('Round 0, Setup')).toBeVisible();
  });

  await test.step('Find the Study on its map', async () => {
    const studyMap = page.getByRole('figure', { name: 'Study' });
    await expect(studyMap.getByRole('group', { name: 'Study' })).toBeVisible();
  });
});

import { expect, test } from './fixtures/test';
import { rolandThreatenedExport, resumeImportedGame } from './fixtures/saved_games';

// A phone held upright, as the screen-phone shots take it, so the play screen shows its compact
// view and opens the detail view.
test.use({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});

// Journey: on a phone, open the detail view from the act in the compact view, swipe along the
// cards row to the agenda, down to the map and the investigators, and go back to the overview.
test('swipe through the detail view on a phone', { tag: '@flow' }, async ({ page }) => {
  const board = page.locator('#board');
  const cardsRow = page.locator('#board > header');
  const swipeTo = (row: number) =>
    board.evaluate((element, to) => element.scrollTo({ top: to * element.clientHeight }), row);

  await test.step('Open the detail view from the act', async () => {
    await resumeImportedGame(
      page,
      'Roland Banks threatened',
      rolandThreatenedExport('Roland Banks threatened'),
    );
    await page.getByRole('region', { name: 'Act' }).click();
    await expect(board).toHaveAttribute('data-view', 'detail');
    await expect(page.getByRole('region', { name: 'Act' })).toBeInViewport({ ratio: 1 });
  });

  await test.step('Swipe back to the agenda', async () => {
    await cardsRow.evaluate((row) => row.scrollBy({ left: -row.clientWidth }));
    await expect(page.getByRole('region', { name: 'Agenda' })).toBeInViewport({ ratio: 1 });
  });

  await test.step('Swipe down to the map', async () => {
    await swipeTo(1);
    await expect(page.getByRole('figure', { name: 'House' })).toBeInViewport();
  });

  await test.step('Swipe down to the investigators', async () => {
    await swipeTo(2);
    await expect(page.getByRole('region', { name: 'Roland Banks' })).toBeInViewport();
  });

  await test.step('Go back to the overview', async () => {
    await page.getByRole('button', { name: 'Back to the overview' }).click();
    await expect(board).not.toHaveAttribute('data-view', 'detail');
    await expect(page.getByRole('button', { name: 'Next' })).toBeVisible();
  });
});

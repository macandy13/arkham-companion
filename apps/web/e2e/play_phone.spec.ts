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

// Journey: on a phone, open the detail view from the act in the compact view, swipe down to the
// map and the investigators, back up to the cards, which wait on the agenda again, and go back to
// the overview. The dots follow along: the rows' at the right edge, the cards' along the foot.
test('swipe through the detail view on a phone', async ({ page }) => {
  const board = page.locator('#board');
  const rowDots = page.locator('ol[data-dots="rows"] > li');
  const cardDots = page.locator('ol[data-dots="items"] > li');
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
    // The cards row's places: encounter deck, agenda, act, scenario and victory display.
    await expect(cardDots).toHaveCount(5);
    await expect(cardDots.nth(2)).toHaveAttribute('data-current');
  });

  await test.step('Swipe down to the map', async () => {
    await swipeTo(1);
    await expect(page.getByRole('figure', { name: 'House' })).toBeInViewport();
    await expect(rowDots.nth(1)).toHaveAttribute('data-current');
  });

  await test.step('Swipe down to the investigators', async () => {
    await swipeTo(2);
    await expect(page.getByRole('region', { name: 'Roland Banks' })).toBeInViewport();
    await expect(rowDots.nth(2)).toHaveAttribute('data-current');
  });

  await test.step('Swipe back up to the cards, which wait on the agenda', async () => {
    await swipeTo(0);
    await expect(page.getByRole('region', { name: 'Agenda' })).toBeInViewport({ ratio: 1 });
    await expect(cardDots.nth(1)).toHaveAttribute('data-current');
  });

  await test.step('Go back to the overview', async () => {
    await page.getByRole('button', { name: 'Back to the overview' }).click();
    await expect(board).not.toHaveAttribute('data-view', 'detail');
    await expect(page.getByRole('button', { name: 'Next' })).toBeVisible();
  });
});

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

// Journey: on a phone, open the map row from the compact map's expand button. Panning the map
// keeps the row, since the map takes every touch; a swipe up from the strip below the map goes on
// to the investigators, and a tap on the strip above it goes to the cards, on the agenda.
test('pan the map and swipe on from its strips on a phone', async ({ page }) => {
  const board = page.locator('#board');
  const rowDots = page.locator('ol[data-dots="rows"] > li');
  const lowerStrip = page.locator('#map > button[data-strip="investigators"]');
  const swipeUp = async (from: { x: number; y: number }) => {
    const touch = await page.context().newCDPSession(page);
    const at = (y: number) => [{ x: from.x, y }];
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(from.y) });
    for (const step of [1, 2, 3, 4, 5, 6])
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: at(from.y - step * 60),
      });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };

  await test.step('Open the map on the whole screen', async () => {
    await resumeImportedGame(
      page,
      'Roland Banks threatened',
      rolandThreatenedExport('Roland Banks threatened'),
    );
    await page.getByRole('button', { name: 'Show the map on the whole screen' }).click();
    await expect(board).toHaveAttribute('data-view', 'detail');
    await expect(rowDots.nth(1)).toHaveAttribute('data-current');
    await expect(lowerStrip).toHaveAccessibleName(/^Roland Banks, 3 actions left, Health /);
  });

  await test.step('Pan the map: the row stays', async () => {
    const map = await page.getByRole('figure', { name: 'House' }).boundingBox();
    if (!map) throw new Error('The map is not shown');
    await swipeUp({ x: map.x + map.width / 2, y: map.y + map.height - 20 });
    await expect(rowDots.nth(1)).toHaveAttribute('data-current');
  });

  await test.step('Swipe up from the strip below the map to the investigators', async () => {
    const strip = await lowerStrip.boundingBox();
    if (!strip) throw new Error('The strip is not shown');
    await swipeUp({ x: strip.x + strip.width / 2, y: strip.y + strip.height / 2 });
    await expect(rowDots.nth(2)).toHaveAttribute('data-current');
    await expect(page.getByRole('region', { name: 'Roland Banks' })).toBeInViewport();
  });

  await test.step('Back on the map, tap the strip above it to go to the cards', async () => {
    await board.evaluate((element) => element.scrollTo({ top: element.clientHeight }));
    await expect(rowDots.nth(1)).toHaveAttribute('data-current');
    await page.locator('#map > button[data-strip="cards"]').click();
    await expect(page.getByRole('region', { name: 'Agenda' })).toBeInViewport({ ratio: 1 });
    await expect(rowDots.nth(0)).toHaveAttribute('data-current');
  });
});

// Journey: on a phone, a tap on the Hallway in the compact map shows it in the map row in place of
// the map, with who is there and what Roland Banks can do; the Map button brings the map back.
test('open a location in the map row on a phone', { tag: '@flow' }, async ({ page }) => {
  const board = page.locator('#board');
  const hallway = page.getByRole('region', { name: 'Hallway' });

  await test.step('Tap the Hallway on the map', async () => {
    await resumeImportedGame(
      page,
      'Roland Banks threatened',
      rolandThreatenedExport('Roland Banks threatened'),
    );
    await page.getByRole('button', { name: 'Details of Hallway' }).click();
    await expect(board).toHaveAttribute('data-view', 'detail');
    await expect(hallway.getByRole('heading', { name: 'Hallway' })).toBeInViewport();
    await expect(hallway.getByRole('button', { name: /^Investigate/ })).toBeVisible();
  });

  await test.step('Go back to the whole map', async () => {
    await hallway.getByRole('button', { name: 'Map' }).click();
    await expect(page.getByRole('figure', { name: 'House' })).toBeInViewport();
    await expect(hallway).toHaveCount(0);
  });
});

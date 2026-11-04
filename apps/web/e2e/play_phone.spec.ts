import type { Locator } from '@playwright/test';
import { expect, test } from './fixtures/test';
import {
  cluesToShareExport,
  houseOpenedExport,
  rolandThreatenedExport,
  resumeImportedGame,
} from './fixtures/saved_games';

// A phone held upright, as the screen-phone shots take it, so the play screen shows its compact
// view and expands its parts.
test.use({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});

// Journey: on a phone, expand the header in place from the act in the compact view: the act grows
// where it was, the map and Roland Banks stay on the screen. Swipe sideways to the agenda, open the
// map on the whole screen from the expanded header, and go back to the overview. The dots follow
// the cards along the header's foot.
test('expand the header in place and swipe through its cards on a phone', async ({ page }) => {
  const board = page.locator('#board');
  const cardDots = page.locator('ol[data-dots="items"] > li');

  await test.step('Expand the header from the act', async () => {
    await resumeImportedGame(
      page,
      'Roland Banks threatened',
      rolandThreatenedExport('Roland Banks threatened'),
    );
    await page.getByRole('region', { name: 'Act' }).click();
    await expect(board).toHaveAttribute('data-view', 'cards');
    await expect(page.getByRole('region', { name: 'Act' })).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('figure', { name: 'House' })).toBeInViewport();
    await expect(page.getByRole('region', { name: 'Roland Banks' })).toBeInViewport();
    // The header's places: encounter deck, agenda, act, scenario and victory display.
    await expect(cardDots).toHaveCount(5);
    await expect(cardDots.nth(2)).toHaveAttribute('data-current');
  });

  await test.step('Swipe back to the agenda', async () => {
    await page
      .locator('#board > header')
      .evaluate((header) => header.scrollTo({ left: header.clientWidth }));
    await expect(page.getByRole('region', { name: 'Agenda' })).toBeInViewport({ ratio: 1 });
    await expect(cardDots.nth(1)).toHaveAttribute('data-current');
  });

  await test.step('Open the map on the whole screen', async () => {
    await page.getByRole('button', { name: 'Show the map on the whole screen' }).click();
    await expect(board).toHaveAttribute('data-view', 'map');
    await expect(page.getByRole('region', { name: 'Agenda' })).toBeHidden();
  });

  await test.step('Go back to the overview', async () => {
    await page.getByRole('button', { name: 'Back to the overview' }).click();
    await expect(board).not.toHaveAttribute('data-view');
    await expect(page.getByRole('button', { name: 'Next' })).toBeVisible();
  });
});

// Journey: on a phone, expand Roland Banks' panel in place from his name: his whole card shows,
// its ability text on the notebook page, with the map and the compact header still on the screen,
// and the × folds it again.
test('expand the investigator in place on a phone', async ({ page }) => {
  const board = page.locator('#board');
  const roland = page.getByRole('region', { name: 'Roland Banks' });

  await test.step("Expand Roland Banks' panel from his name", async () => {
    await resumeImportedGame(
      page,
      'Roland Banks threatened',
      rolandThreatenedExport('Roland Banks threatened'),
    );
    await roland.getByRole('heading', { name: 'Roland Banks' }).getByRole('button').click();
    await expect(board).toHaveAttribute('data-view', 'investigators');
    await expect(roland.getByText(/Invented text for the tests/)).toBeInViewport();
    await expect(page.getByRole('figure', { name: 'House' })).toBeInViewport();
    await expect(page.getByRole('region', { name: 'Agenda' })).toBeInViewport();
  });

  await test.step('Fold it again', async () => {
    await page.getByRole('button', { name: 'Back to the overview' }).click();
    await expect(board).not.toHaveAttribute('data-view');
  });
});

// Journey: on a phone with two investigators, expand Roland Banks' panel in place: his whole card
// fills the screen's width and Daisy Walker's waits beside it, off the screen. Swipe sideways to
// her, and the dots follow.
test(
  'expand the investigators in place and swipe sideways between them on a phone',
  { tag: '@flow' },
  async ({ page }) => {
    const roland = page.getByRole('region', { name: 'Roland Banks' });
    const daisy = page.getByRole('region', { name: 'Daisy Walker' });
    const panelDots = page.locator('ol[data-dots="items"] > li');

    await test.step("Expand Roland Banks' panel", async () => {
      await resumeImportedGame(page, 'Clues to share', cluesToShareExport('Clues to share'));
      await roland.getByRole('heading', { name: 'Roland Banks' }).getByRole('button').click();
      await expect(page.locator('#board')).toHaveAttribute('data-view', 'investigators');
      await expect(roland).toBeInViewport({ ratio: 0.9 });
      await expect(daisy).not.toBeInViewport();
      await expect(panelDots).toHaveCount(2);
      await expect(panelDots.nth(0)).toHaveAttribute('data-current');
    });

    await test.step('Swipe sideways to Daisy Walker', async () => {
      await page
        .locator('#board > #investigators')
        .evaluate((bar) => bar.scrollTo({ left: bar.clientWidth }));
      await expect(daisy).toBeInViewport({ ratio: 0.9 });
      await expect(roland).not.toBeInViewport();
      await expect(panelDots.nth(1)).toHaveAttribute('data-current');
    });
  },
);

// Journey: on a phone, swipe instead of tapping: down on the compact header expands it on the act
// under the finger, up on it folds it; up on Roland Banks' panel expands it, down folds it.
test(
  'swipe the header and the investigator bigger and smaller on a phone',
  { tag: '@flow' },
  async ({ page }) => {
    const board = page.locator('#board');
    const swipe = async (on: Locator, by: number) => {
      const box = await on.boundingBox();
      if (!box) throw new Error('Nothing to swipe on');
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      const touch = await page.context().newCDPSession(page);
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (const step of [1, 2, 3, 4])
        await touch.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x, y: y + (step * by) / 4 }],
        });
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };

    await test.step('Swipe down on the act to expand the header', async () => {
      await resumeImportedGame(
        page,
        'Roland Banks threatened',
        rolandThreatenedExport('Roland Banks threatened'),
      );
      await swipe(page.getByRole('region', { name: 'Act' }), 80);
      await expect(board).toHaveAttribute('data-view', 'cards');
      await expect(page.getByRole('region', { name: 'Act' })).toBeInViewport({ ratio: 1 });
    });

    await test.step('Swipe up on it to fold the header', async () => {
      await swipe(page.getByRole('region', { name: 'Act' }), -80);
      await expect(board).not.toHaveAttribute('data-view');
    });

    await test.step("Swipe up on Roland Banks' card to expand it", async () => {
      const card = page.getByRole('region', { name: 'Roland Banks' }).locator('article');
      await swipe(card, -80);
      await expect(board).toHaveAttribute('data-view', 'investigators');
    });

    await test.step('Swipe down on it to fold it', async () => {
      const card = page.getByRole('region', { name: 'Roland Banks' }).locator('article');
      await swipe(card, 80);
      await expect(board).not.toHaveAttribute('data-view');
    });
  },
);

// Journey: on a phone, open the map on the whole screen from the compact map's expand button. A
// tap on the strip above it expands the header on the agenda, and the strip below it shows the
// turn's investigator.
test('open the map on a phone and go on from its strips', async ({ page }) => {
  const board = page.locator('#board');
  const lowerStrip = page.locator('#map > button[data-strip="investigators"]');

  await test.step('Open the map on the whole screen', async () => {
    await resumeImportedGame(
      page,
      'Roland Banks threatened',
      rolandThreatenedExport('Roland Banks threatened'),
    );
    await page.getByRole('button', { name: 'Show the map on the whole screen' }).click();
    await expect(board).toHaveAttribute('data-view', 'map');
    await expect(lowerStrip).toHaveAccessibleName(/^Roland Banks, 3 actions left, Health /);
  });

  await test.step('Tap the strip above the map to expand the header', async () => {
    await page.locator('#map > button[data-strip="cards"]').click();
    await expect(board).toHaveAttribute('data-view', 'cards');
    await expect(page.getByRole('region', { name: 'Agenda' })).toBeInViewport({ ratio: 1 });
  });
});

// Journey: on a phone, a tap on the Hallway in the compact map shows it in the map row in place of
// the map, its neighbours around it; a tap on the Attic above it shows the Attic, where Roland
// Banks moves, and the Map button brings the map back.
test('open a location in the map row and move on from it on a phone', async ({ page }) => {
  const board = page.locator('#board');
  const shown = page.locator('#map > section[data-mode="location"]');

  await test.step('Tap the Hallway on the map', async () => {
    await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));
    await page.getByRole('button', { name: 'Details of Hallway' }).click();
    await expect(board).toHaveAttribute('data-view', 'map');
    await expect(shown.getByRole('heading', { name: 'Hallway' })).toBeInViewport();
  });

  await test.step('Jump to the Attic beside it', async () => {
    await shown.getByRole('button', { name: /^Go to Attic/ }).click();
    await expect(shown.getByRole('heading', { name: 'Attic' })).toBeInViewport();
  });

  await test.step('Move Roland Banks there', async () => {
    await shown.getByRole('button', { name: 'Move here · 1 action' }).click();
    await expect(shown.getByRole('region', { name: 'Here' })).toContainText('Roland Banks');
  });

  await test.step('Go back to the whole map', async () => {
    await shown.getByRole('button', { name: 'Map' }).click();
    await expect(page.getByRole('figure', { name: 'House' })).toBeInViewport();
    await expect(shown).toHaveCount(0);
  });
});

test.describe('a phone held sideways', () => {
  test.use({ viewport: { width: 844, height: 390 } });

  // The tablet's board, its header in one short row, so the map and the panel still show.
  test('keeps the map and the investigator panel on the screen', async ({ page }) => {
    await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));

    await expect(page.locator('#board')).not.toHaveAttribute('data-view');
    await expect(
      page.getByRole('figure', { name: 'House' }).getByRole('group', { name: 'Hallway' }),
    ).toBeInViewport();
    await expect(page.getByRole('region', { name: 'Roland Banks' })).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Next' })).toBeInViewport({ ratio: 1 });
  });
});

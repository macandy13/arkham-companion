import { expect, isCardList, test } from '../fixtures/test';

// The loading screen and the inline spinner (coding guidelines §3).

test('the loading screen with the games loaded and the card data on its way', async ({ page }) => {
  await page.route(isCardList, () => undefined);

  await page.goto('/#/');

  await expect(page.getByRole('progressbar', { name: 'Starting the app' })).toHaveAttribute(
    'aria-valuenow',
    '1',
  );
  await expect(page.getByRole('list', { name: 'Start-up steps' })).toContainText('Card data');
});

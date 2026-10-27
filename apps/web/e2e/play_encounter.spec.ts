import { expect, test } from './fixtures/test';
import { mythosDrawnExport, resumeImportedGame } from './fixtures/saved_games';

// Journey: a player card tells Roland Banks to draw from the encounter deck on his turn – open the
// encounter dialog from the header, draw for him, answer its test and see where the card went.
test('draw an encounter card for Roland Banks on his turn', { tag: '@flow' }, async ({ page }) => {
  await test.step('Resume a game after two mythos phases and start Roland Banks’ turn', async () => {
    await resumeImportedGame(page, 'Two mythos draws', mythosDrawnExport('Two mythos draws'));
    await page.getByRole('button', { name: 'Start turn' }).click();
  });

  await test.step('Open the encounter dialog from the deck and draw for Roland Banks', async () => {
    await page.getByRole('button', { name: '24 cards left in the encounter deck' }).click();
    await page
      .getByRole('dialog', { name: 'Encounter deck' })
      .getByRole('button', { name: 'Draw for Roland Banks' })
      .click();
  });

  await test.step('Crypt Chill is drawn: Roland Banks passes its willpower test', async () => {
    const cryptChill = page.getByRole('dialog', { name: 'Test for Crypt Chill' });
    await expect(
      page.getByRole('button', { name: '23 cards left in the encounter deck' }),
    ).toBeVisible();
    await cryptChill.getByRole('button', { name: 'Passed' }).click();
  });

  await test.step('Crypt Chill resolves: a notice and the discard pile say where it went', async () => {
    await expect(page.getByRole('status', { name: 'Encounter cards drawn' })).toHaveText(
      /Crypt Chill for Roland Banks: discard pile/,
    );
    await expect(
      page.getByRole('button', {
        name: 'Encounter discard pile, 2 cards, Crypt Chill on top',
      }),
    ).toBeVisible();
  });
});

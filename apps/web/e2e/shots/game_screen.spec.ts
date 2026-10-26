import { expect, test } from '../fixtures/test';
import {
  rolandThreatenedExport,
  houseOpenedExport,
  investigationOpenExport,
  mythosDrawnExport,
  resumeImportedGame,
  twoMapsExport,
} from '../fixtures/saved_games';

// Situations on the game screen, each photographed as it ends (`@shot`, coding guidelines §3).

test('the house map with Roland Banks in the Hallway', async ({ page }) => {
  await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));

  const hallway = page
    .getByRole('figure', { name: 'House' })
    .getByRole('group', { name: 'Hallway' });
  await expect(hallway.getByRole('img', { name: 'Roland Banks' })).toBeVisible();
});

test('map tabs for the Study and the house, the house chosen', async ({ page }) => {
  await resumeImportedGame(page, 'Two maps', twoMapsExport('Two maps'));

  await page.getByRole('tab', { name: 'House' }).click();

  await expect(page.getByRole('tabpanel', { name: 'House' })).toBeVisible();
});

test('Roland Banks with four treacheries and the Ghoul Priest, scrolled on to the Ghoul Priest', async ({
  page,
}) => {
  await resumeImportedGame(
    page,
    'Roland Banks threatened',
    rolandThreatenedExport('Roland Banks threatened'),
  );

  const roland = page.getByRole('region', { name: 'Roland Banks' });
  const threatArea = roland.getByRole('list', { name: 'Threat area' });
  const ghoulPriest = threatArea.getByRole('listitem', {
    name: 'Ghoul Priest, 3 of 5 health left, 2 damage',
  });
  await expect(threatArea.getByRole('listitem')).toHaveCount(5);
  await expect(ghoulPriest).not.toBeInViewport({ ratio: 1 });

  await roland.getByRole('button', { name: 'Later cards in the threat area' }).click();

  await expect(ghoulPriest).toBeInViewport({ ratio: 1 });
});

test('the Hallway’s details, its card with Roland Banks on it, on Roland Banks’ turn', async ({
  page,
}) => {
  await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));

  await page.getByRole('figure', { name: 'House' }).getByRole('group', { name: 'Hallway' }).click();

  const details = page.getByRole('dialog', { name: 'Hallway' });
  await expect(details.getByRole('img', { name: 'The card of Hallway' })).toBeVisible();
  await expect(details.getByRole('button', { name: 'Investigate · 1 action' })).toBeVisible();
});

test('the house map by day', async ({ page }) => {
  await page.goto('/#/settings');
  await page.getByLabel('Theme').selectOption('Light');
  await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));

  await expect(page.getByRole('region', { name: 'Roland Banks' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('Roland Banks’ combat boosted by 2, as an ally in play gives it', async ({ page }) => {
  await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));
  const roland = page.getByRole('region', { name: 'Roland Banks' });

  await page.getByRole('button', { name: 'Adjust board' }).click();
  await roland.getByRole('button', { name: 'Raise the Combat boost' }).click();
  await roland.getByRole('button', { name: 'Raise the Combat boost' }).click();
  await page.getByRole('button', { name: 'Done' }).click();

  await expect(roland.getByRole('button', { name: 'Combat 6, boosted +2' })).toBeVisible();
});

test('Roland Banks’ willpower and agility test, a token drawn', async ({ page }) => {
  await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));

  await page
    .getByRole('region', { name: 'Roland Banks' })
    .getByRole('button', { name: /^Willpower/ })
    .click();
  const test = page.getByRole('dialog', { name: /^Skill test/ });
  await test.getByRole('button', { name: /^Agility/ }).click();
  await test.getByRole('button', { name: 'Draw a token' }).click();

  await expect(test.getByRole('status')).toBeVisible();
});

test('the decision dialog asking for the result of an investigation, a token drawn', async ({
  page,
}) => {
  await resumeImportedGame(page, 'Investigating', investigationOpenExport('Investigating'));
  const decision = page.getByRole('dialog', { name: 'Investigate Hallway' });

  await decision.getByRole('button', { name: 'Draw a token' }).click();

  await expect(decision.getByRole('status')).toBeVisible();
});

test("Roland Banks' fight against the Ghoul Priest, the damage raised to 2", async ({ page }) => {
  await resumeImportedGame(
    page,
    'Roland Banks threatened',
    rolandThreatenedExport('Roland Banks threatened'),
  );
  const roland = page.getByRole('region', { name: 'Roland Banks' });
  await roland.getByRole('button', { name: 'Later cards in the threat area' }).click();
  await roland.getByRole('button', { name: 'Details of Ghoul Priest' }).click();
  await page.getByRole('button', { name: 'Fight · 1 action' }).click();
  const decision = page.getByRole('dialog', { name: 'Fight Ghoul Priest' });

  await decision.getByRole('button', { name: 'Raise the Damage dealt' }).click();

  await expect(decision.getByRole('region', { name: 'Damage dealt' })).toContainText('2');
});

test("the Ghoul Priest's details opened from its card on Roland Banks' turn", async ({ page }) => {
  await resumeImportedGame(
    page,
    'Roland Banks threatened',
    rolandThreatenedExport('Roland Banks threatened'),
  );
  const roland = page.getByRole('region', { name: 'Roland Banks' });
  await roland.getByRole('button', { name: 'Later cards in the threat area' }).click();

  await roland.getByRole('button', { name: 'Details of Ghoul Priest' }).click();

  await expect(page.getByRole('dialog', { name: 'Ghoul Priest' })).toBeVisible();
});

test('the encounter deck after two mythos phases, Dissonant Voices on the discard pile', async ({
  page,
}) => {
  await resumeImportedGame(page, 'Two mythos draws', mythosDrawnExport('Two mythos draws'));

  const deck = page.getByRole('region', { name: 'Encounter deck' });
  await expect(
    deck.getByRole('button', { name: '24 cards left in the encounter deck' }),
  ).toBeVisible();
  await expect(
    deck.getByRole('button', { name: 'Encounter discard pile, 1 card, Dissonant Voices on top' }),
  ).toBeVisible();
});

test('the encounter dialog opened on the discard pile after two mythos phases', async ({
  page,
}) => {
  await resumeImportedGame(page, 'Two mythos draws', mythosDrawnExport('Two mythos draws'));

  await page
    .getByRole('button', { name: 'Encounter discard pile, 1 card, Dissonant Voices on top' })
    .click();

  const dialog = page.getByRole('dialog', { name: 'Encounter deck' });
  await expect(dialog.getByRole('listitem').filter({ hasText: 'Dissonant Voices' })).toBeVisible();
});

test('Crypt Chill drawn for Roland Banks, its willpower test waiting', async ({ page }) => {
  await resumeImportedGame(page, 'Two mythos draws', mythosDrawnExport('Two mythos draws'));
  await page.getByRole('button', { name: 'Start turn' }).click();
  await page.getByRole('button', { name: '24 cards left in the encounter deck' }).click();

  await page.getByRole('button', { name: 'Draw for Roland Banks' }).click();

  const cryptChill = page.getByRole('dialog', { name: 'Test for Crypt Chill' });
  await expect(cryptChill.getByText('Crypt Chill, drawn for Roland Banks')).toBeVisible();
  await expect(cryptChill.getByRole('img', { name: 'Crypt Chill' })).toBeVisible();
});

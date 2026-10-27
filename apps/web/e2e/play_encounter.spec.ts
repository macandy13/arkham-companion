import { expect, test } from './fixtures/test';
import { houseOpenedExport, mythosDrawnExport, resumeImportedGame } from './fixtures/saved_games';

// Journey: a player card tells Roland Banks to draw from the encounter deck on his turn – open the
// encounter dialog from the header, draw for him, answer its test and see where the card went.
test('draw an encounter card for Roland Banks on his turn', async ({ page }) => {
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

// Journey: Dissonant Voices was discarded, but a revelation the app left to the players puts it
// into Roland Banks' threat area – open the discard pile, where it lies on top, and move it there.
test('move Dissonant Voices from the discard pile into Roland Banks’ threat area', async ({
  page,
}) => {
  await test.step('Resume a game after two mythos phases and open the discard pile', async () => {
    await resumeImportedGame(page, 'Two mythos draws', mythosDrawnExport('Two mythos draws'));
    await page
      .getByRole('button', { name: 'Encounter discard pile, 1 card, Dissonant Voices on top' })
      .click();
  });

  await test.step('Put Dissonant Voices, the top card, into Roland Banks’ threat area', async () => {
    await page
      .getByRole('dialog', { name: 'Discard pile (1)' })
      .getByRole('region', { name: 'Dissonant Voices' })
      .getByRole('button', { name: "Into Roland Banks's threat area" })
      .click();
  });

  await test.step('Roland Banks’ threat area holds it, and the discard pile is empty', async () => {
    await expect(
      page.getByRole('button', { name: 'Encounter discard pile', exact: true }),
    ).toBeVisible();
    await expect(
      page
        .getByRole('region', { name: 'Roland Banks' })
        .getByRole('list', { name: 'Threat area' })
        .getByRole('listitem')
        .filter({ hasText: 'Dissonant Voices' }),
    ).toBeVisible();
  });
});

// Journey: a card effect spawns the set-aside Ghoul Priest at a location the players choose – open
// the set-aside cards on the scenario card, tap Spawn, then tap the Attic on the map.
test('spawn the set-aside Ghoul Priest in the Attic', { tag: '@flow' }, async ({ page }) => {
  const attic = page.getByRole('figure', { name: 'House' }).getByRole('group', { name: 'Attic' });

  await test.step('Resume a game with the house open and open the set-aside cards', async () => {
    await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));
    await page
      .getByRole('region', { name: 'Scenario' })
      .getByRole('button', { name: /^Set aside, / })
      .click();
  });

  await test.step('Choose the Ghoul Priest and tap Spawn', async () => {
    const dialog = page.getByRole('dialog', { name: /^Set aside/ });
    await dialog.getByRole('button', { name: 'Ghoul Priest' }).click();
    await dialog.getByRole('button', { name: 'Spawn' }).click();
    await expect(page.getByRole('status', { name: 'Choose a spawn location' })).toHaveText(
      /Tap the location where Ghoul Priest spawns/,
    );
  });

  await test.step('Tap the Attic: the Ghoul Priest spawns there', async () => {
    await attic.click();
    await expect(attic.getByRole('img', { name: /^Ghoul Priest/ })).toBeVisible();
    await expect(page.getByRole('status', { name: 'Choose a spawn location' })).toHaveCount(0);
  });
});

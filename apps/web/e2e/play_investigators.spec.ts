import { expect, test } from './fixtures/test';
import { dragTo } from './fixtures/drag';
import {
  ghoulPriestInCellarExport,
  houseOpenedExport,
  inTheParlorExport,
  resumeImportedGame,
  rolandThreatenedExport,
} from './fixtures/saved_games';
import { startQuickGame } from './fixtures/wizard';

// Journey: take an investigator's turn from their panel – start it, see their actions, investigate, and end it,
// as the players do on the table.
test('take a turn from the investigator panel', async ({ page }) => {
  const bar = page.getByRole('region', { name: 'Investigators' });

  await test.step('Start a quick game in the investigation phase', async () => {
    await page.goto('/#/new');
    await startQuickGame(page);
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByRole('heading', { name: 'Round 1' })).toBeVisible();
  });

  await test.step('Start the turn', async () => {
    await bar.getByRole('button', { name: 'Start turn' }).click();
    await expect(bar.getByRole('list', { name: '3 actions left' })).toBeVisible();
  });

  await test.step('Investigate and report the test as passed', async () => {
    await bar.getByRole('button', { name: 'Investigate' }).click();
    const decision = page.getByRole('dialog', { name: 'Investigate Study' });
    await decision.getByRole('button', { name: 'Passed' }).click();
    await decision.getByRole('button', { name: 'Done' }).click();
    await expect(decision).toBeHidden();
    await expect(bar.getByRole('list', { name: '2 actions left' })).toBeVisible();
  });

  await test.step('End the turn', async () => {
    await bar.getByRole('button', { name: 'End turn' }).click();
    await expect(bar.getByText(/^Turn taken · /)).toBeVisible();
  });
});

// Journey: the play action pays the card's cost: tap the resources it costs on the play sheet, and
// the card is played with them spent, one action gone.
test('play a card and pay its cost', async ({ page }) => {
  const roland = page.getByRole('region', { name: 'Roland Banks' });
  const resources = roland.locator('[data-stat="resources"] data');

  await test.step('Resume a game on Roland Banks’ turn with 5 resources', async () => {
    await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));
    await expect(resources).toHaveText('5');
  });

  await test.step('Play a card and tap the 3 resources it costs', async () => {
    await roland.getByRole('button', { name: 'Play a card' }).click();
    const sheet = page.getByRole('dialog', { name: 'Play a card' });
    await sheet.getByRole('button', { name: 'resource 3' }).click();
    await expect(sheet.getByText('Pays 3 · 2 left')).toBeVisible();
    await sheet.getByRole('button', { name: 'Play · pay 3' }).click();
    await expect(sheet).toBeHidden();
  });

  await test.step('The 3 resources are spent with the action', async () => {
    await expect(resources).toHaveText('2');
    await expect(roland.getByRole('list', { name: '2 actions left' })).toBeVisible();
  });
});

// Journey: resign through the card that offers it, the Parlor's "[action] Resign.", from the turn row.
test('resign at the Parlor', async ({ page }) => {
  const roland = page.getByRole('region', { name: 'Roland Banks' });

  await test.step('Resume a game with Roland Banks in the Parlor on their turn', async () => {
    await resumeImportedGame(page, 'In the Parlor', inTheParlorExport('In the Parlor'));
    await expect(roland.getByText(/^Turn · Parlor/)).toBeVisible();
  });

  await test.step('Resign', async () => {
    await roland.getByRole('button', { name: 'Resign · Parlor' }).click();
    await expect(roland.getByText('Resigned')).toBeVisible();
  });
});

// Journey: the resource action under an engaged enemy: the Ghoul Priest attacks first, as every
// action but fight and evade provokes it, and only then does Roland Banks gain the resource.
test('take a resource while the Ghoul Priest is engaged', async ({ page }) => {
  const roland = page.getByRole('region', { name: 'Roland Banks' });
  const resources = roland.locator('[data-stat="resources"] data');

  await test.step('Resume a game with the Ghoul Priest engaged with Roland Banks', async () => {
    await resumeImportedGame(
      page,
      'Roland threatened',
      rolandThreatenedExport('Roland threatened'),
    );
    await expect(resources).toHaveText('5');
  });

  await test.step('Take a resource: the Ghoul Priest attacks first', async () => {
    await roland.getByRole('button', { name: 'Take a resource' }).click();
    const attack = page.getByRole('dialog', { name: 'Attack of opportunity by Ghoul Priest' });
    await expect(
      attack.getByText('Roland Banks takes a resource: Ghoul Priest attacks first'),
    ).toBeVisible();
    await expect(resources).toHaveText('5');
    await attack.getByRole('button', { name: 'Done' }).click();
  });

  await test.step('Then the resource arrives and the action is spent', async () => {
    await expect(resources).toHaveText('6');
    await expect(roland.getByRole('list', { name: '2 actions left' })).toBeVisible();
  });
});

// Journey: tokens a card deals or gives, dragged off the header's token pool: damage and horror onto
// Roland Banks' card, a resource for them, and damage onto the Ghoul Priest; then the damage healed
// by dragging it back onto the pool.
test('take damage, horror and resources from the token pool and heal it back', async ({ page }) => {
  const pool = page.getByRole('region', { name: 'Token pool' });
  const roland = page.getByRole('region', { name: 'Roland Banks' });
  const resources = roland.locator('[data-stat="resources"] data');
  const priest = page
    .getByRole('figure', { name: 'House' })
    .getByRole('group', { name: 'Cellar' })
    .getByRole('img', { name: /^Ghoul Priest/ });

  await test.step('Import a game in which the Ghoul Priest lurks in the Cellar', async () => {
    await resumeImportedGame(
      page,
      'The Ghoul Priest is out',
      ghoulPriestInCellarExport('The Ghoul Priest is out'),
    );
    await expect(roland.getByRole('img', { name: '9/9' })).toBeVisible();
  });

  await test.step('Drag a damage and a horror onto Roland Banks, as a treachery deals them', async () => {
    await dragTo(page, pool.getByRole('img', { name: 'Damage from the pool' }), roland);
    await expect(roland.getByRole('img', { name: '8/9' })).toBeVisible();
    await dragTo(page, pool.getByRole('img', { name: 'Horror from the pool' }), roland);
    await expect(roland.getByRole('img', { name: '4/5' })).toBeVisible();
  });

  await test.step('Drag a resource onto Roland Banks, as a card gives one', async () => {
    const before = Number(await resources.textContent());
    await dragTo(page, pool.getByRole('img', { name: 'Resource from the pool' }), roland);
    await expect(resources).toHaveText(String(before + 1));
  });

  await test.step('Drag a damage onto the Ghoul Priest', async () => {
    await dragTo(page, pool.getByRole('img', { name: 'Damage from the pool' }), priest);
    await expect(priest).toHaveAccessibleName('Ghoul Priest, 1 damage');
  });

  await test.step('Heal them again: drag the damage off Roland Banks and the Ghoul Priest back to the pool', async () => {
    await dragTo(page, roland.locator('[data-stat="health"] [data-drag]'), pool);
    await expect(roland.getByRole('img', { name: '9/9' })).toBeVisible();
    await dragTo(page, page.locator('#map [data-marker="damage"] > [data-part="grip"]'), pool);
    await expect(priest).toHaveAccessibleName('Ghoul Priest');
  });
});

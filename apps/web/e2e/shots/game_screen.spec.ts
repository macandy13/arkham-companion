import { expect, test } from '../fixtures/test';
import {
  cluesToShareExport,
  rolandThreatenedExport,
  houseOpenedExport,
  inTheParlorExport,
  investigationOpenExport,
  litaControlledExport,
  mythosDrawnExport,
  mythosDrawnStepsExport,
  pilesFilledExport,
  resumeImportedGame,
  twoMapsExport,
} from '../fixtures/saved_games';

// Situations on the game screen, each photographed as it ends (`@shot`, coding guidelines §3).

test('the house map with Roland Banks in the Hallway', { tag: '@shot' }, async ({ page }) => {
  await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));

  const hallway = page
    .getByRole('figure', { name: 'House' })
    .getByRole('group', { name: 'Hallway' });
  await expect(hallway.getByRole('img', { name: 'Roland Banks' })).toBeVisible();
});

test(
  'map tabs for the Study and the house, the house chosen',
  { tag: '@shot' },
  async ({ page }) => {
    await resumeImportedGame(page, 'Two maps', twoMapsExport('Two maps'));

    await page.getByRole('tab', { name: 'House' }).click();

    await expect(page.getByRole('tabpanel', { name: 'House' })).toBeVisible();
  },
);

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

test(
  'the Hallway’s details, its card with Roland Banks on it, on Roland Banks’ turn',
  { tag: '@shot' },
  async ({ page }) => {
    await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));

    await page
      .getByRole('figure', { name: 'House' })
      .getByRole('group', { name: 'Hallway' })
      .click();

    // A dialog on a tablet, the location mode in place of the map on a phone.
    const details = page
      .getByRole('dialog', { name: 'Hallway' })
      .or(page.getByRole('region', { name: 'Hallway' }));
    await expect(details.getByRole('img', { name: 'The card of Hallway' })).toBeVisible();
    await expect(details.getByRole('button', { name: 'Investigate · 1 action' })).toBeVisible();
  },
);

test('the house map by day', { tag: '@shot' }, async ({ page }) => {
  await page.goto('/#/settings');
  await page.getByLabel('Theme').selectOption('Light');
  await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));

  await expect(page.getByRole('region', { name: 'Roland Banks' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test(
  'the house map in the card pictures style, the clues left on each card',
  { tag: '@shot' },
  async ({ page }) => {
    await page.goto('/#/settings');
    await page.getByLabel('Card style').selectOption('Card pictures');
    await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));

    const hallway = page
      .getByRole('figure', { name: 'House' })
      .getByRole('group', { name: 'Hallway' });
    await expect(hallway.getByRole('img', { name: 'Clues 0' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-card-theme', 'pictures');
  },
);

test('the game log after two rounds, scrolled to the newest step under its round and phase', async ({
  page,
}) => {
  await resumeImportedGame(page, 'Two rounds', mythosDrawnStepsExport('Two rounds'));

  await page.getByRole('button', { name: 'Game log' }).click();

  const log = page.getByRole('dialog', { name: 'Game log' });
  const newestRound = log.getByRole('listitem', { name: 'Round 3 · Investigation' });
  await expect(newestRound.getByRole('heading')).toBeInViewport();
  await expect(newestRound.getByRole('listitem').last()).toBeInViewport();
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
  isMobile,
}) => {
  await resumeImportedGame(page, 'Two mythos draws', mythosDrawnExport('Two mythos draws'));

  const deck = page.getByRole('region', { name: 'Encounter deck' });
  // A phone's compact header shows the deck alone, and a tap opens the detail view on its piles.
  if (isMobile) await deck.click();
  await expect(
    deck.getByRole('button', { name: '24 cards left in the encounter deck' }),
  ).toBeVisible();
  await expect(
    deck.getByRole('button', { name: 'Encounter discard pile, 1 card, Dissonant Voices on top' }),
  ).toBeVisible();
});

test('the header with its piles fanned: seven cards discarded, the set-aside cards on the scenario card, the Ghoul Priest in the victory display', async ({
  page,
  isMobile,
}) => {
  await resumeImportedGame(page, 'Piles filled', pilesFilledExport('Piles filled'));
  // A phone's compact header shows the deck alone, and a tap opens the detail view on its piles.
  if (isMobile) await page.getByRole('region', { name: 'Encounter deck' }).click();

  await expect(
    page.getByRole('button', { name: /^Encounter discard pile, 7 cards, .* on top$/ }),
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Scenario' }).getByRole('button', { name: /^Set aside, / }),
  ).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: 'Victory' })
      .getByRole('button', { name: 'Victory display, 2 victory points' }),
  ).toBeVisible();
});

test('the discard pile of seven cards in its dialog, the top card chosen, scroll arrows beside the row', async ({
  page,
  isMobile,
}) => {
  await resumeImportedGame(page, 'Piles filled', pilesFilledExport('Piles filled'));
  // A phone's compact header shows the deck alone, and a tap opens the detail view on its piles.
  if (isMobile) await page.getByRole('region', { name: 'Encounter deck' }).click();

  await page.getByRole('button', { name: /^Encounter discard pile, 7 cards, / }).click();

  const dialog = page.getByRole('dialog', { name: 'Discard pile (7)' });
  await expect(dialog.getByRole('button', { name: 'Later cards' })).toBeVisible();
  await expect(dialog.getByRole('button', { pressed: true })).toBeVisible();
});

test('Crypt Chill drawn for Roland Banks, its willpower test waiting', async ({
  page,
  isMobile,
}) => {
  await resumeImportedGame(page, 'Two mythos draws', mythosDrawnExport('Two mythos draws'));
  await page.getByRole('button', { name: 'Start turn' }).click();
  const deck = page.getByRole('region', { name: 'Encounter deck' });
  // A phone's compact header shows the deck alone, and a tap opens the detail view on its piles.
  if (isMobile) await deck.click();
  await deck.getByRole('button', { name: '24 cards left in the encounter deck' }).click();

  await page.getByRole('button', { name: 'Draw for Roland Banks' }).click();

  const cryptChill = page.getByRole('dialog', { name: 'Test for Crypt Chill' });
  await expect(cryptChill.getByText('Crypt Chill, drawn for Roland Banks')).toBeVisible();
  await expect(cryptChill.getByRole('img', { name: 'Crypt Chill' })).toBeVisible();
});

test('The Barrier opened as a full card', async ({ page, isMobile }) => {
  await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));
  const act = page.getByRole('region', { name: 'Act' });

  await act.getByRole('button', { name: 'The Barrier' }).click();

  // A dialog on a tablet; on a phone the detail view, which shows the act in full in its place.
  const card = isMobile ? act : page.getByRole('dialog', { name: 'The Barrier' });
  await expect(card.getByRole('img', { name: 'Clues 0 / 3' })).toBeInViewport();
});

test('Frozen in Fear from Roland Banks’ threat area, zoomed to read', async ({ page }) => {
  await resumeImportedGame(
    page,
    'Roland Banks threatened',
    rolandThreatenedExport('Roland Banks threatened'),
  );

  await page
    .getByRole('region', { name: 'Roland Banks' })
    .getByRole('button', { name: 'Read Frozen in Fear' })
    .first()
    .click();

  await expect(page.getByRole('dialog', { name: 'Frozen in Fear' })).toBeVisible();
});

test('the attack of opportunity Roland Banks provokes by taking a resource', async ({ page }) => {
  await resumeImportedGame(
    page,
    'Roland Banks threatened',
    rolandThreatenedExport('Roland Banks threatened'),
  );

  await page
    .getByRole('region', { name: 'Roland Banks' })
    .getByRole('button', { name: 'Take a resource' })
    .click();

  const attack = page.getByRole('dialog', { name: 'Attack of opportunity by Ghoul Priest' });
  await expect(
    attack.getByText('Roland Banks takes a resource: Ghoul Priest attacks first'),
  ).toBeVisible();
});

test('the Parlor’s details with its Resign among Roland Banks’ card actions', async ({ page }) => {
  await resumeImportedGame(page, 'In the Parlor', inTheParlorExport('In the Parlor'));

  // On a phone the investigator panel lies over the Parlor's tile, so the keyboard opens it.
  await page.getByRole('button', { name: 'Details of Parlor' }).press('Enter');

  // A dialog on a tablet, the location mode in place of the map on a phone.
  const parlor = page
    .getByRole('dialog', { name: 'Parlor' })
    .or(page.getByRole('region', { name: 'Parlor' }));
  await expect(
    parlor
      .getByRole('region', { name: 'Card actions' })
      .getByRole('button', { name: 'Resign · Parlor' }),
  ).toBeVisible();
});

test('the unrevealed Parlor’s details, its barrier offering Roland Banks no move', async ({
  page,
}) => {
  await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));

  // On a phone the investigator panel lies over the Parlor's tile, so the keyboard opens it.
  await page.getByRole('button', { name: 'Details of Parlor' }).press('Enter');

  // A dialog on a tablet, the location mode in place of the map on a phone.
  const parlor = page
    .getByRole('dialog', { name: 'Parlor' })
    .or(page.getByRole('region', { name: 'Parlor' }));
  await expect(parlor.getByRole('heading', { name: 'Parlor' })).toBeVisible();
  await expect(parlor.getByRole('button', { name: /^Move here/ })).toHaveCount(0);
});

test('the Parlor tile printing its Resign', { tag: '@shot' }, async ({ page }) => {
  await resumeImportedGame(page, 'In the Parlor', inTheParlorExport('In the Parlor'));

  const parlor = page.getByRole('figure', { name: 'House' }).getByRole('group', { name: 'Parlor' });
  await expect(parlor.getByText('Resign.')).toBeVisible();
});

test('Lita Chantler under Roland Banks’ card, in their control', async ({ page }) => {
  await resumeImportedGame(page, 'Lita in control', litaControlledExport('Lita in control'));

  const cardsInPlay = page
    .getByRole('region', { name: 'Roland Banks' })
    .getByRole('list', { name: 'Cards in play' });
  await expect(cardsInPlay.getByRole('listitem')).toHaveText('Lita Chantler');
});

test('who pays the 4 clues to advance Trapped, Daisy Walker 3 and Roland Banks 1', async ({
  page,
  isMobile,
}) => {
  await resumeImportedGame(page, 'Clues to share', cluesToShareExport('Clues to share'));
  // A phone's compact header hides the act's plate; its detail view shows the act in full.
  if (isMobile) await page.getByRole('region', { name: 'Act' }).click();

  await page.getByRole('region', { name: 'Act' }).getByRole('button', { name: 'Advance' }).click();
  const dialog = page.getByRole('dialog', { name: 'Who pays the clues to advance Trapped?' });
  for (const token of [
    'clue 3 of Roland Banks',
    'clue 2 of Roland Banks',
    'clue 2 of Daisy Walker',
    'clue 3 of Daisy Walker',
  ])
    await dialog.getByRole('button', { name: token }).click();

  await expect(dialog.getByText(/^4 of 4 clues chosen/)).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Pay', exact: true })).toBeEnabled();
});

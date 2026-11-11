import { expect, test } from '../fixtures/test';
import {
  cluesToShareExport,
  ghoulPriestInCellarExport,
  midnightMasksStartedExport,
  rolandHurtExport,
  rolandThreatenedExport,
  houseOpenedExport,
  investigationOpenExport,
  mythosDrawnExport,
  mythosDrawnStepsExport,
  pilesFilledExport,
  resumeImportedGame,
} from '../fixtures/saved_games';

// The game screen's main situations, each photographed as it ends; its corner cases are
// checked by their DOM alone in `e2e/states/game_screen.spec.ts` (coding guidelines §3).

test('the house map with Roland Banks in the Hallway', async ({ page }) => {
  await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));

  const hallway = page
    .getByRole('figure', { name: 'House' })
    .getByRole('group', { name: 'Hallway' });
  await expect(hallway.getByRole('img', { name: 'Roland Banks' })).toBeVisible();
});

test('Roland Banks’ card opened whole from its art, to read its abilities', async ({ page }) => {
  await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));

  await page
    .getByRole('region', { name: 'Roland Banks' })
    .getByRole('button', { name: "Show Roland Banks's card" })
    .click();

  const card = page.getByRole('dialog', { name: 'Roland Banks' });
  await expect(card.getByRole('heading', { name: 'Roland Banks' })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Combat 4' })).toBeVisible();
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

  // A dialog on a tablet, the location mode in place of the map on a phone.
  const details = page
    .getByRole('dialog', { name: 'Hallway' })
    .or(page.getByRole('region', { name: 'Hallway' }));
  await expect(details.getByRole('img', { name: 'The card of Hallway' })).toBeVisible();
  await expect(details.getByRole('button', { name: 'Investigate · 1 action' })).toBeVisible();
});

test.describe('each table with its own playmat', () => {
  test.use({ realPlaymats: true });

  test('the house map on the Night and brass table', async ({ page }) => {
    await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));

    await expect(page.getByRole('region', { name: 'Roland Banks' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-skin', 'nightAndBrass');
  });

  test('the house map on the parchment table', async ({ page }) => {
    await page.goto('/#/settings');
    await page.getByRole('radio', { name: 'Parchment' }).check();
    await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));

    await expect(page.getByRole('region', { name: 'Roland Banks' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  for (const { skin, code } of [
    { skin: 'The Stars Are Right', code: 'stars' },
    { skin: 'Sunken R’lyeh', code: 'rlyeh' },
  ]) {
    test(`the house map on the ${skin} table`, async ({ page }) => {
      await page.goto('/#/settings');
      await page.getByRole('radio', { name: skin }).check();
      await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));

      await expect(page.getByRole('region', { name: 'Roland Banks' })).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-skin', code);
    });
  }
});

test('the house map in the card pictures style, the clues left on each card', async ({ page }) => {
  await page.goto('/#/settings');
  await page.getByLabel('Card style').selectOption('Card pictures');
  await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));

  const hallway = page
    .getByRole('figure', { name: 'House' })
    .getByRole('group', { name: 'Hallway' });
  await expect(hallway.getByRole('img', { name: 'Clues 0' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-card-theme', 'pictures');
  await expect(page.locator('[data-card="scenario"]')).toHaveAttribute('data-picture', 'shown');
});

test('the house map in the Eldritch card style', async ({ page }) => {
  await page.goto('/#/settings');
  await page.getByLabel('Card style').selectOption('Eldritch');
  await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));

  await expect(page.getByRole('region', { name: 'Roland Banks' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-card-theme', 'eldritch');
});

test('the Ghoul Priest in the Cellar, its token cut from the card art', async ({ page }) => {
  await resumeImportedGame(
    page,
    'The Ghoul Priest is out',
    ghoulPriestInCellarExport('The Ghoul Priest is out'),
  );

  const cellar = page.getByRole('figure', { name: 'House' }).getByRole('group', { name: 'Cellar' });
  const priest = cellar.getByRole('img', { name: /^Ghoul Priest/ });
  await expect(priest.locator('[data-part="avatar"]')).toHaveAttribute('data-picture', 'shown');
});

test('the house map in the Night and brass card style', async ({ page }) => {
  await page.goto('/#/settings');
  await page.getByLabel('Card style').selectOption('Night and brass');
  await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));

  await expect(page.getByRole('region', { name: 'Roland Banks' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-card-theme', 'nightAndBrass');
});

test('the game log after two rounds, scrolled to the newest step under its round and phase, what the app tells the players above', async ({
  page,
  isMobile,
}) => {
  await resumeImportedGame(page, 'Two rounds', mythosDrawnStepsExport('Two rounds'));

  // A phone keeps the log in the header's menu.
  if (isMobile) await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Game log' }).click();

  const log = page.getByRole('dialog', { name: 'Game log' });
  const newestRound = log.getByRole('listitem', { name: 'Round 3 · Investigation' });
  await expect(newestRound.getByRole('heading')).toBeInViewport();
  await expect(newestRound.getByRole('listitem').last()).toBeInViewport();
  await expect(log.getByRole('combobox', { name: 'What the app tells you' })).toHaveValue(
    'display',
  );
  const mythos = log.getByRole('listitem', { name: 'Round 3 · Mythos' });
  // The line alone, without "(mythos phase)" after it.
  await expect(
    mythos.getByRole('listitem').filter({ hasText: /^1 doom on What's Going On\?!$/ }),
  ).toBeVisible();
});

test("the upkeep's notice of what the game did, its cause and how to set it right", async ({
  page,
}) => {
  await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));

  await page.getByRole('button', { name: 'End turn' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  const changes = page.getByRole('status', { name: 'What the game did' });
  await expect(changes.getByRole('listitem')).toHaveText([
    'Roland Banks draws 1 card (upkeep phase)',
    'Roland Banks gains 1 resource (upkeep phase)',
  ]);
});

test('Roland Banks’ willpower test before a token is drawn, the draw button in its place', async ({
  page,
}) => {
  await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));

  await page
    .getByRole('region', { name: 'Roland Banks' })
    .getByRole('button', { name: /^Willpower/ })
    .click();
  const test = page.getByRole('dialog', { name: /^Skill test/ });

  await expect(test.getByRole('button', { name: 'Draw a token' })).toBeVisible();
});

test('Roland Banks playing a card, 3 of his 5 resources tapped to pay it', async ({ page }) => {
  await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));

  await page
    .getByRole('region', { name: 'Roland Banks' })
    .getByRole('button', { name: 'Play a card' })
    .click();
  const sheet = page.getByRole('dialog', { name: 'Play a card' });
  await sheet.getByRole('button', { name: 'resource 3' }).click();

  await expect(sheet.getByRole('button', { name: 'Play · pay 3' })).toBeEnabled();
});

test('Roland Banks’ health bubble, opened by a double tap on his heart', async ({ page }) => {
  await resumeImportedGame(page, 'Roland Banks hurt', rolandHurtExport('Roland Banks hurt'));

  await page
    .getByRole('region', { name: 'Roland Banks' })
    .getByRole('img', { name: '6/9' })
    .dblclick();

  await expect(
    page
      .getByRole('complementary', { name: 'Roland Banks · Health' })
      .getByRole('button', { name: 'Heal damage' }),
  ).toBeEnabled();
});

test('the decision dialog asking for the result of an investigation, a token drawn', async ({
  page,
}) => {
  await resumeImportedGame(page, 'Investigating', investigationOpenExport('Investigating'));
  const decision = page.getByRole('dialog', { name: 'Investigate Hallway' });

  await decision.getByRole('button', { name: 'Draw a token' }).click();

  await expect(decision.getByRole('status')).toBeVisible();
});

test("the Ghoul Priest's details opened from its card on Roland Banks' turn, both Frozen in Fear raising the fight to 3 actions", async ({
  page,
}) => {
  await resumeImportedGame(
    page,
    'Roland Banks threatened',
    rolandThreatenedExport('Roland Banks threatened'),
  );
  const roland = page.getByRole('region', { name: 'Roland Banks' });
  await roland.getByRole('button', { name: 'Later cards in the threat area' }).click();

  await roland.getByRole('button', { name: 'Details of Ghoul Priest' }).click();

  const details = page.getByRole('dialog', { name: 'Ghoul Priest' });
  await expect(details.getByRole('button', { name: 'Fight · 3 actions' })).toBeVisible();
});

test('the header with its piles fanned: seven cards discarded, the set-aside cards on the scenario card, the Ghoul Priest in the victory display, the token pool beside it', async ({
  page,
  isMobile,
}) => {
  await resumeImportedGame(page, 'Piles filled', pilesFilledExport('Piles filled'));
  // A phone's compact header shows the deck alone, and a tap expands the header on its piles.
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

test(
  'Crypt Chill drawn for Roland Banks, asking whether its revelation resolves',
  { tag: '@shot' },
  async ({ page, isMobile }) => {
    await resumeImportedGame(page, 'Two mythos draws', mythosDrawnExport('Two mythos draws'));
    await page.getByRole('button', { name: 'Start turn' }).click();
    const deck = page.getByRole('region', { name: 'Encounter deck' });
    // A phone's compact header shows the deck alone, and a tap expands the header on its piles.
    if (isMobile) await deck.click();
    await deck.getByRole('button', { name: '24 cards left in the encounter deck' }).click();

    await page.getByRole('button', { name: 'Draw for Roland Banks' }).click();

    const revelation = page.getByRole('dialog', { name: 'Revelation of Crypt Chill' });
    await expect(revelation.getByRole('button', { name: 'Resolve' })).toBeVisible();
    await expect(revelation.getByRole('button', { name: 'Cancel revelation' })).toBeVisible();
  },
);

test('The Barrier opened as a full card', async ({ page, isMobile }) => {
  await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));
  const act = page.getByRole('region', { name: 'Act' });

  await act.getByRole('button', { name: 'The Barrier' }).click();

  // A dialog on a tablet; on a phone the expanded header, which shows the act in full in its place.
  const card = isMobile ? act : page.getByRole('dialog', { name: 'The Barrier' });
  await expect(card.getByRole('img', { name: 'Clues 0 / 3' })).toBeInViewport();
});

test('The Gathering’s reference card opened to read', async ({ page, isMobile }) => {
  await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));
  const scenario = page.getByRole('region', { name: 'Scenario' });

  // On a phone the first tap expands the header on the card, too narrow there for its rows.
  if (isMobile) await scenario.locator('[data-card]').click();
  await scenario.getByRole('button', { name: 'The Gathering' }).click();

  await expect(
    page
      .getByRole('dialog', { name: 'The Gathering' })
      .getByRole('list', { name: 'Chaos tokens' })
      .getByText('-1. On a failure, take 1 horror.'),
  ).toBeInViewport();
});

test(
  'the chaos bag on the reference card’s page, the elder sign sealed on Roland Banks',
  { tag: '@shot' },
  async ({ page, isMobile }) => {
    await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));
    const scenario = page.getByRole('region', { name: 'Scenario' });
    if (isMobile) await scenario.locator('[data-card]').click();
    await scenario.getByRole('button', { name: 'The Gathering' }).click();
    const bag = page
      .getByRole('dialog', { name: 'The Gathering' })
      .getByRole('region', { name: 'Chaos bag' });

    await bag.getByRole('button', { name: /^Elder Sign/ }).click();
    await bag.getByRole('button', { name: 'Seal Elder Sign on Roland Banks' }).click();

    const sealed = bag.getByRole('list', { name: 'Sealed' });
    await expect(sealed).toHaveText(/Elder Sign on Roland Banks/);
    await sealed.scrollIntoViewIfNeeded();
  },
);

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

test('who pays the 4 clues to advance Trapped, Daisy Walker 3 and Roland Banks 1', async ({
  page,
  isMobile,
}) => {
  await resumeImportedGame(page, 'Clues to share', cluesToShareExport('Clues to share'));
  // A phone's compact header hides the act's plate; its detail view shows the act in full.
  if (isMobile) await page.getByRole('region', { name: 'Act' }).click();

  await page.getByRole('region', { name: 'Act' }).getByRole('button', { name: 'Advance' }).click();
  const dialog = page.getByRole('dialog', { name: 'Who pays the clues?' });
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

test('Arkham in The Midnight Masks, Easttown, the Graveyard and Northside with their new symbols', async ({
  page,
}) => {
  await resumeImportedGame(
    page,
    'The Midnight Masks started',
    midnightMasksStartedExport('The Midnight Masks started'),
  );
  const map = page.locator('#map');

  for (const symbol of ['moon', 'hourglass', 'T']) {
    await expect(
      map.getByRole('img', { name: `Connection symbol: ${symbol}`, exact: true }),
    ).toBeVisible();
  }
});

test('the chaos bag in the cardboard token set', async ({ page, isMobile }) => {
  await page.goto('/#/settings');
  await page.getByRole('radio', { name: 'Cardboard' }).click();
  await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));
  const scenario = page.getByRole('region', { name: 'Scenario' });
  if (isMobile) await scenario.locator('[data-card]').click();
  await scenario.getByRole('button', { name: 'The Gathering' }).click();

  const bag = page
    .getByRole('dialog', { name: 'The Gathering' })
    .getByRole('region', { name: 'Chaos bag' });
  await bag.scrollIntoViewIfNeeded();
  await expect(page.locator('html')).toHaveAttribute('data-token-set', 'cardboard');
});

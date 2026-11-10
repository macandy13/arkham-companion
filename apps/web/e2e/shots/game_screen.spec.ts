import { expect, test } from '../fixtures/test';
import {
  cluesToShareExport,
  doomBesideDamageExport,
  ghoulPriestInCellarExport,
  graspingHandsDrawnExport,
  graveyardTestExport,
  midnightMasksStartedExport,
  tangledThicketRevealedExport,
  rolandSurroundedExport,
  rolandHurtExport,
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
import { dragTo } from '../fixtures/drag';

// Situations on the game screen, each photographed as it ends (coding guidelines §3).

test('the house map with Roland Banks in the Hallway', async ({ page }) => {
  await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));

  const hallway = page
    .getByRole('figure', { name: 'House' })
    .getByRole('group', { name: 'Hallway' });
  await expect(hallway.getByRole('img', { name: 'Roland Banks' })).toBeVisible();
});

test('the Ghoul Priest in the Cellar with doom beside its damage, and doom on the Cellar', async ({
  page,
}) => {
  await resumeImportedGame(page, 'Doom and damage', doomBesideDamageExport('Doom and damage'));

  const cellar = page.getByRole('figure', { name: 'House' }).getByRole('group', { name: 'Cellar' });
  await expect(cellar.getByRole('img', { name: 'Ghoul Priest, 2 damage, Doom 1' })).toBeVisible();
  await expect(cellar.getByRole('img', { name: 'Doom 1', exact: true })).toBeVisible();
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

test('the token pool in the cardboard token set', async ({ page, isMobile }) => {
  test.skip(isMobile, 'a phone has no room for the token pool (game.css)');
  await page.goto('/#/settings');
  await page.getByRole('radio', { name: 'Cardboard' }).check();
  await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));

  await expect(page.getByRole('img', { name: 'Resource from the pool' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-token-set', 'cardboard');
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

test('Roland Banks with 3 damage and 1 horror: 6 health and 4 sanity left, the pips taken greyed', async ({
  page,
}) => {
  await resumeImportedGame(page, 'Roland hurt', rolandHurtExport('Roland hurt'));

  const roland = page.getByRole('region', { name: 'Roland Banks' });
  await expect(roland.getByRole('img', { name: '6/9' })).toBeVisible();
  await expect(roland.getByRole('img', { name: '4/5' })).toBeVisible();
});

test('Roland Banks’ whole card in the card pictures style, his counters live on the printed card', async ({
  page,
}) => {
  await page.goto('/#/settings');
  await page.getByLabel('Card style').selectOption('Card pictures');
  await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));
  const roland = page.getByRole('region', { name: 'Roland Banks' });
  await expect(roland.getByRole('article')).toHaveAttribute('data-picture', 'shown');

  await roland.getByRole('button', { name: "Show Roland Banks's card" }).click();

  const card = page.getByRole('dialog', { name: 'Roland Banks' }).getByRole('article');
  await expect(card).toHaveAttribute('data-picture', 'shown');
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

test('the Ghoul Priest in the Cellar, its token showing its initial as the settings ask', async ({
  page,
}) => {
  await page.goto('/#/settings');
  await page.getByLabel('Enemy tokens').selectOption('Initials');
  await resumeImportedGame(
    page,
    'The Ghoul Priest is out',
    ghoulPriestInCellarExport('The Ghoul Priest is out'),
  );

  const cellar = page.getByRole('figure', { name: 'House' }).getByRole('group', { name: 'Cellar' });
  const priest = cellar.getByRole('img', { name: /^Ghoul Priest/ });
  await expect(priest.locator('[data-part="avatar"]')).toBeHidden();
  await expect(priest.locator('text').first()).toBeVisible();
});

test("the Ghoul Priest's details in the Eldritch card style: a blackletter name, tentacle scrolls, its set icon on the medallion", async ({
  page,
}) => {
  await page.goto('/#/settings');
  await page.getByLabel('Card style').selectOption('Eldritch');
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

test("the Ghoul Priest's details in the card pictures style, its damage on the printed health", async ({
  page,
}) => {
  await page.goto('/#/settings');
  await page.getByLabel('Card style').selectOption('Card pictures');
  await resumeImportedGame(
    page,
    'Roland Banks threatened',
    rolandThreatenedExport('Roland Banks threatened'),
  );
  const roland = page.getByRole('region', { name: 'Roland Banks' });
  await roland.getByRole('button', { name: 'Later cards in the threat area' }).click();

  await roland.getByRole('button', { name: 'Details of Ghoul Priest' }).click();

  const card = page.getByRole('dialog', { name: 'Ghoul Priest' }).locator('svg[data-card="enemy"]');
  await expect(card).toHaveAttribute('data-picture', 'shown');
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

test('Roland Banks’ combat boosted by 2, as an ally in play gives it', async ({ page }) => {
  await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));
  const roland = page.getByRole('region', { name: 'Roland Banks' });

  await roland.getByRole('button', { name: /^Combat/ }).dblclick();
  const bubble = page.getByRole('complementary', { name: 'Roland Banks · Combat boost' });
  await bubble.getByRole('button', { name: 'Raise the Combat boost' }).click();
  await bubble.getByRole('button', { name: 'Raise the Combat boost' }).click();
  await page.keyboard.press('Escape');

  await expect(roland.getByRole('button', { name: 'Combat 6, boosted +2' })).toBeVisible();
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

test('the Hallway’s clue and doom bubble, opened by a double tap on its tile', async ({ page }) => {
  await resumeImportedGame(page, 'Roland Banks hurt', rolandHurtExport('Roland Banks hurt'));

  await page.getByRole('group', { name: 'Hallway' }).dblclick();

  await expect(
    page.getByRole('complementary', { name: 'Hallway' }).getByRole('button', { name: 'Add doom' }),
  ).toBeEnabled();
});

test('the agenda’s doom bubble, opened by a double tap on the agenda', async ({
  page,
  isMobile,
}) => {
  await resumeImportedGame(page, 'Roland Banks hurt', rolandHurtExport('Roland Banks hurt'));
  const agenda = page.getByRole('region', { name: 'Agenda' });
  // The phone's compact header opens its detail view on a tap first, where the card takes taps.
  if (isMobile) await agenda.click();

  await agenda.locator('[data-card="agenda"]').dblclick();

  await expect(
    page.getByRole('complementary', { name: /· Doom$/ }).getByRole('button', { name: 'Add doom' }),
  ).toBeEnabled();
});

test('Roland Banks’ willpower boost bubble, opened by a double tap on the skill', async ({
  page,
}) => {
  await resumeImportedGame(page, 'Roland Banks hurt', rolandHurtExport('Roland Banks hurt'));

  await page
    .getByRole('region', { name: 'Roland Banks' })
    .getByRole('button', { name: /^Willpower/ })
    .dblclick();

  await expect(
    page
      .getByRole('complementary', { name: 'Roland Banks · Willpower boost' })
      .getByRole('button', { name: 'Raise the Willpower boost' }),
  ).toBeEnabled();
});

test('Roland Banks’ willpower test with the group’s own chaos bag, no draw button', async ({
  page,
}) => {
  await page.goto('/#/settings');
  await page
    .getByRole('group', { name: 'Who draws the tokens' })
    .getByRole('radio', { name: 'Our own bag' })
    .check();
  await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));

  await page
    .getByRole('region', { name: 'Roland Banks' })
    .getByRole('button', { name: /^Willpower/ })
    .click();
  const test = page.getByRole('dialog', { name: /^Skill test/ });

  await expect(test.getByRole('region', { name: 'Result' })).toBeVisible();
  await expect(test.getByRole('button', { name: 'Draw a token' })).toBeHidden();
});

test('Roland Banks’ willpower and agility test, the tablet drawn with its −2 under it', async ({
  page,
}) => {
  // The Gathering's Standard bag lists 16 tokens, the tablet 14th: the draw picks it.
  await page.addInitScript(() => {
    Math.random = () => 13.5 / 16;
  });
  await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));

  await page
    .getByRole('region', { name: 'Roland Banks' })
    .getByRole('button', { name: /^Willpower/ })
    .click();
  const test = page.getByRole('dialog', { name: /^Skill test/ });
  await test.getByRole('button', { name: /^Agility/ }).click();
  await test.getByRole('button', { name: 'Draw a token' }).click();

  await expect(test.getByRole('list', { name: 'Tokens drawn' })).toHaveText('Tablet −2');
});

test('the decision dialog asking for the result of an investigation, a token drawn', async ({
  page,
}) => {
  await resumeImportedGame(page, 'Investigating', investigationOpenExport('Investigating'));
  const decision = page.getByRole('dialog', { name: 'Investigate Hallway' });

  await decision.getByRole('button', { name: 'Draw a token' }).click();

  await expect(decision.getByRole('status')).toBeVisible();
});

test('the investigation decision lowered to reach the board', async ({ page }) => {
  await resumeImportedGame(page, 'Investigating', investigationOpenExport('Investigating'));
  const decision = page.getByRole('dialog', { name: 'Investigate Hallway' });

  await decision.getByRole('button', { name: 'Lower to reach the board' }).click();

  await expect(decision.getByRole('button', { name: 'Raise the dialog' })).toBeVisible();
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
  await page.getByRole('button', { name: 'Fight · 3 actions' }).click();
  const decision = page.getByRole('dialog', { name: 'Fight Ghoul Priest' });

  await decision.getByRole('button', { name: 'Raise the Damage dealt' }).click();

  await expect(decision.getByRole('region', { name: 'Damage dealt' })).toContainText('2');
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

test('the encounter deck after two mythos phases, Dissonant Voices on the discard pile', async ({
  page,
  isMobile,
}) => {
  await resumeImportedGame(page, 'Two mythos draws', mythosDrawnExport('Two mythos draws'));

  const deck = page.getByRole('region', { name: 'Encounter deck' });
  // A phone's compact header shows the deck alone, and a tap expands the header on its piles.
  if (isMobile) await deck.click();
  await expect(
    deck.getByRole('button', { name: '24 cards left in the encounter deck' }),
  ).toBeVisible();
  await expect(
    deck.getByRole('button', { name: 'Encounter discard pile, 1 card, Dissonant Voices on top' }),
  ).toBeVisible();
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

test('the discard pile of seven cards on its wide page, the top card chosen, scroll arrows beside the row', async ({
  page,
  isMobile,
}) => {
  await resumeImportedGame(page, 'Piles filled', pilesFilledExport('Piles filled'));
  // A phone's compact header shows the deck alone, and a tap expands the header on its piles.
  if (isMobile) await page.getByRole('region', { name: 'Encounter deck' }).click();

  await page.getByRole('button', { name: /^Encounter discard pile, 7 cards, / }).click();

  const dialog = page.getByRole('dialog', { name: 'Discard pile (7)' });
  await expect(dialog.getByRole('button', { name: 'Later cards' })).toBeVisible();
  await expect(dialog.getByRole('button', { pressed: true })).toBeVisible();
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

test('Crypt Chill drawn for Roland Banks, its willpower test waiting', async ({
  page,
  isMobile,
}) => {
  await resumeImportedGame(page, 'Two mythos draws', mythosDrawnExport('Two mythos draws'));
  await page.getByRole('button', { name: 'Start turn' }).click();
  const deck = page.getByRole('region', { name: 'Encounter deck' });
  // A phone's compact header shows the deck alone, and a tap expands the header on its piles.
  if (isMobile) await deck.click();
  await deck.getByRole('button', { name: '24 cards left in the encounter deck' }).click();

  await page.getByRole('button', { name: 'Draw for Roland Banks' }).click();
  await page
    .getByRole('dialog', { name: 'Revelation of Crypt Chill' })
    .getByRole('button', { name: 'Resolve' })
    .click();

  const cryptChill = page.getByRole('dialog', { name: 'Test for Crypt Chill' });
  await expect(cryptChill.getByText('Crypt Chill, drawn for Roland Banks')).toBeVisible();
  await expect(cryptChill.getByRole('button', { name: 'Read Crypt Chill' })).toBeVisible();
});

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

test('the chaos bag in the cardboard token set', { tag: '@shot' }, async ({ page, isMobile }) => {
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

test('Frozen in Fear from Roland Banks’ threat area, on the card shell', async ({ page }) => {
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

test('three attacks of opportunity on Roland Banks, the Ghoul Minions fanned behind the Ghoul Priest', async ({
  page,
}) => {
  await resumeImportedGame(
    page,
    'Roland Banks surrounded',
    rolandSurroundedExport('Roland Banks surrounded'),
  );

  await page
    .getByRole('region', { name: 'Roland Banks' })
    .getByRole('button', { name: 'Take a resource' })
    .click();

  const attack = page.getByRole('dialog', { name: 'Attack of opportunity by Ghoul Priest' });
  await expect(
    attack.getByRole('list', { name: 'Waiting next' }).getByRole('listitem'),
  ).toHaveCount(2);
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

test('the Parlor tile printing its Resign', async ({ page }) => {
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

test('Grasping Hands failed by 2 with no token drawn in the app, its margin of failure on the Failed row', async ({
  page,
}) => {
  await resumeImportedGame(page, 'Grasping Hands', graspingHandsDrawnExport('Grasping Hands'));
  const decision = page.getByRole('dialog', { name: 'Test for Grasping Hands' });

  await decision.getByRole('button', { name: 'Failed' }).click();
  await decision.getByRole('button', { name: 'Raise the Margin of failure' }).click();

  await expect(
    decision.getByRole('region', { name: 'Margin of failure' }).locator('data'),
  ).toHaveText('2');
});

test('the Graveyard’s failed willpower test, its choice under the Failed row', async ({ page }) => {
  await resumeImportedGame(page, 'In the Graveyard', graveyardTestExport('In the Graveyard'));
  const decision = page.getByRole('dialog').filter({ hasText: 'Willpower test (3)' });

  await decision.getByRole('button', { name: 'Failed' }).click();

  await expect(decision.getByRole('button', { name: 'Take 2 horror' })).toBeVisible();
  await expect(decision.getByRole('button', { name: 'Move to Rivertown' })).toBeVisible();
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

test('the Tangled Thicket revealed with its double slash, the other Arkham Woods still showing their square', async ({
  page,
}) => {
  await resumeImportedGame(
    page,
    'The Tangled Thicket revealed',
    tangledThicketRevealedExport('The Tangled Thicket revealed'),
  );
  const map = page.locator('#map');

  await expect(map.getByRole('img', { name: 'Connection symbol: double slash' })).toHaveCount(1);
  await expect(map.getByRole('img', { name: 'Connection symbol: square' })).toHaveCount(3);
});

test('the status row marked offline once the network is gone', async ({ page }) => {
  await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));

  await page.context().setOffline(true);

  await expect(page.getByRole('region', { name: 'Round 1' }).getByText('Offline')).toBeVisible();
});

test('the menu open, holding the game log on a phone', async ({ page }) => {
  await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));

  await page.getByRole('button', { name: 'Menu' }).click();

  await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
});

test('the menu after saving the pictures of the game for offline play', async ({ page }) => {
  await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));
  await page.getByRole('button', { name: 'Menu' }).click();

  await page.getByRole('button', { name: 'Save pictures for offline play' }).click();

  await expect(page.getByRole('button', { name: /^Pictures saved: \d+ of \d+$/ })).toBeVisible();
});

test('Daisy Walker swiped into view on a phone, Roland Banks beside her', async ({
  page,
  isMobile,
}) => {
  await resumeImportedGame(page, 'Clues to share', cluesToShareExport('Clues to share'));
  const daisy = page.getByRole('region', { name: 'Daisy Walker' });

  if (isMobile) await daisy.evaluate((panel) => panel.scrollIntoView({ inline: 'start' }));

  await expect(daisy).toBeVisible();
  if (isMobile) await expect(daisy).toHaveAttribute('data-focus', 'true');
});

test('the refusal toast after Roland Banks is dragged from the Attic to the Cellar, which it does not connect to', async ({
  page,
}) => {
  await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));
  const house = page.getByRole('figure', { name: 'House' });
  const roland = (location: string) =>
    house.getByRole('group', { name: location }).getByRole('img', { name: 'Roland Banks' });
  await dragTo(page, roland('Hallway'), house.getByRole('group', { name: 'Attic' }));

  await dragTo(page, roland('Attic'), house.getByRole('group', { name: 'Cellar' }));

  await expect(page.getByRole('alert', { name: 'Not possible' })).toContainText(
    'Those locations are not connected.',
  );
});

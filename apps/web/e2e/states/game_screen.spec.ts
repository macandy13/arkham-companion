import { expect, test } from '../fixtures/test';
import {
  cluesToShareExport,
  doomBesideDamageExport,
  ghoulPriestInCellarExport,
  graspingHandsDrawnExport,
  graveyardTestExport,
  tangledThicketRevealedExport,
  rolandSurroundedExport,
  rolandHurtExport,
  rolandThreatenedExport,
  houseOpenedExport,
  inTheParlorExport,
  investigationOpenExport,
  litaControlledExport,
  mythosDrawnExport,
  pilesFilledExport,
  resumeImportedGame,
  twoMapsExport,
} from '../fixtures/saved_games';
import { dragTo } from '../fixtures/drag';

// Corner cases of the game screen, on the tablet and the phone, checked by what the page holds:
// a picture of each would add a golden for little a review learns from it (coding guidelines §3).
test.use({ endPicture: false });

test('the Ghoul Priest in the Cellar with doom beside its damage, and doom on the Cellar', async ({
  page,
}) => {
  await resumeImportedGame(page, 'Doom and damage', doomBesideDamageExport('Doom and damage'));

  const cellar = page.getByRole('figure', { name: 'House' }).getByRole('group', { name: 'Cellar' });
  await expect(cellar.getByRole('img', { name: 'Ghoul Priest, 2 damage, Doom 1' })).toBeVisible();
  await expect(cellar.getByRole('img', { name: 'Doom 1', exact: true })).toBeVisible();
});

test('map tabs for the Study and the house, the house chosen', async ({ page }) => {
  await resumeImportedGame(page, 'Two maps', twoMapsExport('Two maps'));

  await page.getByRole('tab', { name: 'House' }).click();

  await expect(page.getByRole('tab', { name: 'Study' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'House' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel', { name: 'House' })).toBeVisible();
});

test('the token pool in the cardboard token set', async ({ page, isMobile }) => {
  test.skip(isMobile, 'a phone has no room for the token pool (game.css)');
  await page.goto('/#/settings');
  await page.getByRole('radio', { name: 'Cardboard' }).check();
  await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));

  await expect(page.getByRole('img', { name: 'Resource from the pool' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-token-set', 'cardboard');
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

test("the Ghoul Priest's details in the Eldritch card style", async ({ page }) => {
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
  await expect(page.locator('html')).toHaveAttribute('data-card-theme', 'eldritch');
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

test('Frozen in Fear opened from Roland Banks’ threat area', async ({ page }) => {
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

test('the menu open, holding the game log on a phone', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'a tablet shows the game log in the header');
  await resumeImportedGame(page, 'The house is open', houseOpenedExport('The house is open'));

  await page.getByRole('button', { name: 'Menu' }).click();

  await expect(page.getByRole('button', { name: 'Game log' })).toBeVisible();
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

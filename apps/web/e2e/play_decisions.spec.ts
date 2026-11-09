import { expect, test } from './fixtures/test';
import {
  ghoulMinionToSpawnExport,
  investigationOpenExport,
  resumeImportedGame,
} from './fixtures/saved_games';

// Journey: the game asks the players something (here the result of Roland Banks' investigation), they
// draw a chaos token for the test in the decision dialog and answer it, which gives the board back.
test('answer a decision in its dialog', async ({ page }) => {
  const decision = page.getByRole('dialog', { name: 'Investigate Hallway' });

  await test.step('Resume a game whose investigation waits for its result', async () => {
    await resumeImportedGame(page, 'Investigating', investigationOpenExport('Investigating'));
    await expect(decision.getByText('Intellect test (1)')).toBeVisible();
  });

  await test.step('Draw a token and see the calculation', async () => {
    await decision.getByRole('button', { name: 'Draw a token' }).click();
    await expect(decision.getByRole('status')).toBeVisible();
  });

  await test.step('Report the test as passed: the Hallway has no clue to count, so it answers at once', async () => {
    await decision.getByRole('button', { name: 'Passed' }).click();
    await expect(decision).toBeHidden();
  });
});

// Journey: a decision waits, but the board needs a correction first – the players lower the dialog
// out of the way, adjust the board from the header to boost Roland Banks' intellect, as a card in
// play does, keep it, and the decision comes back raised with the boost in its test.
test('lower a decision to adjust the board first', async ({ page }) => {
  const decision = page.getByRole('dialog', { name: 'Investigate Hallway' });
  const roland = page.getByRole('region', { name: 'Roland Banks' });

  await test.step('Resume a game whose investigation waits for its result', async () => {
    await resumeImportedGame(page, 'Investigating', investigationOpenExport('Investigating'));
    await expect(decision.getByText('Intellect test (1)')).toBeVisible();
  });

  await test.step('Lower the decision with its grab handle', async () => {
    await decision.getByRole('button', { name: 'Lower to reach the board' }).click();
    await expect(decision.getByRole('button', { name: 'Raise the dialog' })).toBeVisible();
  });

  await test.step("Boost Roland Banks' intellect while adjusting the board", async () => {
    await page.getByRole('button', { name: 'Adjust board' }).click();
    await expect(decision).toBeHidden();
    await roland.getByRole('button', { name: 'Raise the Intellect boost' }).click();
    await page.getByRole('button', { name: 'Done' }).click();
  });

  await test.step('Find the decision back, raised, its intellect 4', async () => {
    await expect(decision.getByRole('button', { name: 'Lower to reach the board' })).toBeVisible();
    await expect(decision.getByRole('button', { name: 'Intellect 4' })).toBeVisible();
  });
});

// Journey: a Ghoul Minion spawns at any empty location, so the game asks where. The players pick
// on the map: the dialog lowers and the empty rooms light up; a tap on the Hallway, where Roland
// Banks stands, brings the question back, and a tap on the Attic answers it.
test('pick the answer to a decision on the map', async ({ page }) => {
  const decision = page.getByRole('dialog', { name: 'Where does Ghoul Minion spawn?' });
  const house = page.getByRole('figure', { name: 'House' });
  const room = (name: string) => house.getByRole('group', { name, exact: true });

  await test.step('Resume a game whose Ghoul Minion waits to spawn', async () => {
    await resumeImportedGame(page, 'Spawning', ghoulMinionToSpawnExport('Spawning'));
    await expect(decision.getByRole('button', { name: 'Attic' })).toBeVisible();
  });

  await test.step('Pick on the map: the dialog lowers and the empty rooms light up', async () => {
    await decision.getByRole('button', { name: 'Pick on the map' }).click();
    await expect(decision.getByRole('button', { name: 'Raise the dialog' })).toBeVisible();
    await expect(room('Attic')).toHaveAttribute('data-pickable', 'true');
    await expect(room('Hallway')).not.toHaveAttribute('data-pickable');
  });

  await test.step('Tap the Hallway, which it cannot spawn in: the question comes back', async () => {
    await room('Hallway').click();
    await expect(decision.getByRole('button', { name: 'Lower to reach the board' })).toBeVisible();
  });

  await test.step('Pick again and tap the Attic: the Ghoul Minion spawns there', async () => {
    await decision.getByRole('button', { name: 'Pick on the map' }).click();
    await room('Attic').click();
    await expect(decision).toBeHidden();
    await expect(room('Attic').getByRole('img', { name: /^Ghoul Minion/ })).toBeVisible();
  });
});

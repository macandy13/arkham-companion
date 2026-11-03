import type { Locator, Page } from '@playwright/test';

/**
 * Drags `piece` (a pawn, an enemy, a token off a count) with the mouse to the middle of `target`,
 * in steps, as a player's finger would.
 */
export async function dragTo(page: Page, piece: Locator, target: Locator): Promise<void> {
  const from = await piece.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error('the piece or its target is not on screen');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 10 });
  await page.mouse.up();
}

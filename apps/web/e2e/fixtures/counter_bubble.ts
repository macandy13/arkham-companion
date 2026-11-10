import type { Page } from '@playwright/test';

/**
 * Steps a counter on `investigator`'s card in place, as the players do now that every value
 * changes where it shows: a double tap on the counter (`stat`, the panel's `data-stat`) opens its
 * − / + bubble, and `button` is pressed there `times` times.
 */
export async function stepInvestigatorCounter(
  page: Page,
  investigator: string,
  stat: 'health' | 'sanity' | 'clues' | 'resources',
  button: string,
  times = 1,
): Promise<void> {
  await page
    .getByRole('region', { name: investigator })
    .locator(`[data-stat="${stat}"] dd > *`)
    .first()
    .dblclick();
  const bubble = page.getByRole('complementary', { name: new RegExp(`^${investigator} · `) });
  for (let step = 0; step < times; step++)
    await bubble.getByRole('button', { name: button }).click();
}

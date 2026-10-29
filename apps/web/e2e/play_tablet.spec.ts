import { expect, test } from './fixtures/test';
import { pilesFilledExport, resumeImportedGame } from './fixtures/saved_games';

// The landscape tablets the play screen is laid out for (product.md "UI concept"): the larger one
// the other specs run on and the smaller one, where the room runs out first.
const tablets = [
  { width: 1180, height: 820 },
  { width: 1024, height: 768 },
];

for (const viewport of tablets) {
  test(`the play screen fits a ${viewport.width} × ${viewport.height} tablet`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await resumeImportedGame(page, 'Piles filled', pilesFilledExport('Piles filled'));

    const victory = page.getByRole('button', { name: 'Victory display, 2 victory points' });
    const agenda = page.getByRole('region', { name: 'Agenda' });
    await expect(victory).toBeVisible();
    const victoryBox = await victory.boundingBox();
    const agendaBox = await agenda.boundingBox();
    // The header's places stay in one row, so the map keeps the height a second row would take.
    expect(victoryBox!.y).toBeLessThan(agendaBox!.y + agendaBox!.height);
    const widths = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(widths.scrollWidth).toBe(widths.clientWidth);
  });
}

// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { toCardCode, type InvestigatorDef } from '@arkham/carddata';
import { initI18n } from '../i18n';
import { InvestigatorSheet } from './InvestigatorSheet';

/** An invented investigator; only its traits and text matter here. */
const investigator = (printed: Pick<InvestigatorDef, 'traits' | 'text'>): InvestigatorDef => ({
  code: toCardCode('fake_hero'),
  name: 'Fake Hero',
  factionCode: 'seeker',
  health: 7,
  sanity: 7,
  skills: { willpower: 3, intellect: 3, combat: 3, agility: 3 },
  packCode: 'fake_pack',
  cyclePosition: 1,
  parallel: false,
  chapter: 1,
  ...printed,
});

function renderSheet(shown: InvestigatorDef) {
  render(
    <InvestigatorSheet
      investigator={shown}
      seatsFull={false}
      imageUrl={(src) => src}
      onSelect={() => {}}
      onMakeLead={() => {}}
      onRemove={() => {}}
      onShowOtherChapter={() => {}}
      onClose={() => {}}
    />,
  );
}

describe('InvestigatorSheet', () => {
  beforeAll(async () => {
    await initI18n('en');
  });
  afterEach(cleanup);

  it('shows the traits and each ability of the card text, its symbols as icons', () => {
    renderSheet(
      investigator({
        traits: 'Miskatonic. Scholar.',
        text: '[reaction] After you discover a clue: Draw 1 card.\n[elder_sign] effect: +1.',
      }),
    );

    const text = screen.getByRole('region', { name: 'Card text' });

    expect([...text.querySelectorAll('p')].map((p) => p.textContent)).toEqual([
      'Miskatonic. Scholar.',
      ' After you discover a clue: Draw 1 card.',
      ' effect: +1.',
    ]);
    expect(
      within(text)
        .getAllByRole('img')
        .map((icon) => icon.getAttribute('aria-label')),
    ).toEqual(['Reaction', 'Elder Sign']);
  });

  it('leaves the card text out for an investigator whose data has none', () => {
    renderSheet(investigator({}));

    expect(screen.queryByRole('region', { name: 'Card text' })).toBeNull();
  });
});

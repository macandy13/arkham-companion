// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { toCardCode, type WeaknessDef } from '@arkham/carddata';
import {
  blankEnemy,
  blankLocation,
  instanceId,
  investigatorId,
  newGame,
  PlayTable,
} from '@arkham/engine';
import { initI18n } from '../i18n';
import { PlayingOn } from '../state/gameActions.test_support';
import { DrawWeakness } from './DrawWeakness';

const alice = investigatorId('alice');
const study = instanceId('study');

/** The catalog's entry for the stalker, a basic weakness enemy the game knows as `stalker`. */
const stalker: WeaknessDef = {
  code: toCardCode('stalker'),
  name: 'Stalker',
  typeCode: 'enemy',
  basic: true,
  traits: [],
  keywords: [],
  entersThreatArea: false,
};
/** Another basic weakness, so the search has something to leave out. */
const dread: WeaknessDef = { ...stalker, code: toCardCode('dread'), name: 'Dread' };

/** Alice in the study, with the stalker in the game's card data, as a game adds the catalog's. */
const aliceInStudy = () =>
  PlayTable.start(
    newGame()
      .withLocation(study, blankLocation('study'))
      .withInvestigator(alice, { locationId: study })
      .withCardData(blankEnemy('stalker')),
  );

const renderDrawWeakness = (table: PlayTable, weaknesses: readonly WeaknessDef[]) =>
  render(
    <PlayingOn table={table}>
      <DrawWeakness investigator={table.board.investigator(alice)} weaknesses={weaknesses} />
    </PlayingOn>,
  );

describe('DrawWeakness', () => {
  beforeAll(async () => {
    await initI18n('en');
  });
  afterEach(cleanup);

  it('narrows the weaknesses by the search', () => {
    renderDrawWeakness(aliceInStudy(), [stalker, dread]);

    fireEvent.click(screen.getByRole('button', { name: 'Draw a weakness' }));
    fireEvent.change(screen.getByRole('searchbox', { hidden: true }), {
      target: { value: 'sta' },
    });

    const dialog = screen.getByRole('dialog', { hidden: true });
    expect(
      within(dialog)
        .getAllByRole('listitem', { hidden: true })
        .map((item) => item.textContent),
    ).toEqual(['Stalker']);
  });

  it('draws the picked weakness, which spawns engaged with alice, and closes', async () => {
    const table = aliceInStudy();
    renderDrawWeakness(table, [stalker]);

    fireEvent.click(screen.getByRole('button', { name: 'Draw a weakness' }));
    fireEvent.click(screen.getByRole('button', { hidden: true, name: 'Stalker' }));
    await act(async () => {});

    expect(table.board.enemiesEngagedWith(alice).map((enemy) => enemy.name)).toEqual(['stalker']);
    expect(screen.queryByRole('dialog', { hidden: true })).toBeNull();
  });

  it('offers nothing before the catalog has weaknesses', () => {
    const table = aliceInStudy();
    render(
      <PlayingOn table={table}>
        <DrawWeakness investigator={table.board.investigator(alice)} weaknesses={undefined} />
      </PlayingOn>,
    );

    expect(screen.queryByRole('button', { name: 'Draw a weakness' })).toBeNull();
  });
});

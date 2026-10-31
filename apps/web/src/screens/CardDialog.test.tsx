// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  blankAgenda,
  blankEnemy,
  blankLocation,
  engagedWith,
  instanceId,
  investigatorId,
  newGame,
  PlayTable,
} from '@arkham/engine';
import { initI18n } from '../i18n';
import { CardDialog } from './CardDialog';

const study = instanceId('study');
const alder = investigatorId('alder');

describe('CardDialog', () => {
  beforeAll(async () => {
    await initI18n('en');
  });
  afterEach(cleanup);

  /** Alder in the Study, the Ghoul Priest engaged with them, the agenda "What's Going On?!". */
  const board = () =>
    PlayTable.start(
      newGame()
        .withLocation(study, blankLocation('study'), { revealed: true })
        .withInvestigator(alder, { name: 'Alder', locationId: study })
        .withAgenda(instanceId('agenda'), blankAgenda("What's Going On?!", null))
        .withCard(instanceId('ghoul_priest'), blankEnemy('Ghoul Priest'), engagedWith(alder)),
    ).board;
  const ghoulPriest = () => board().cardsIn({ kind: 'engaged', investigatorId: alder })[0];
  const agenda = () => board().cardsIn({ kind: 'agendaDeck' })[0];

  it.each([
    { what: 'an upright card beside the page', card: ghoulPriest, actor: true, shell: 'beside' },
    { what: 'a sideways card over the page', card: agenda, actor: true, shell: 'above' },
    {
      what: 'the investigator over a page without a card',
      card: () => undefined,
      actor: true,
      shell: 'portrait',
    },
    {
      what: 'the page alone without a card or investigator',
      card: () => undefined,
      actor: false,
      shell: 'page',
    },
  ])('lays out $what', ({ card, actor, shell }) => {
    const subject = card();
    render(
      <CardDialog
        name="decision"
        {...(subject ? { card: subject } : {})}
        {...(actor ? { actor: board().investigator(alder) } : {})}
        title="Attack of opportunity"
        onCancel={() => {}}
      >
        <p>The page</p>
      </CardDialog>,
    );

    expect(screen.getByRole('dialog').dataset['shell']).toBe(shell);
  });

  it('puts who acts in the kicker over the title, and opens the card whole when tapped', () => {
    const ghoul = ghoulPriest();
    if (!ghoul) throw new Error('the Ghoul Priest is engaged');
    render(
      <CardDialog
        name="decision"
        card={ghoul}
        actor={board().investigator(alder)}
        kicker="Alder decides"
        title="Attack of opportunity"
        onCancel={() => {}}
      >
        <p>The page</p>
      </CardDialog>,
    );

    expect(screen.getByRole('heading', { name: 'Attack of opportunity' })).toBeDefined();
    expect(screen.getByText('Alder decides')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Read Ghoul Priest' }));

    expect(screen.getByRole('dialog', { name: 'Ghoul Priest' })).toBeDefined();
  });

  it('passes Escape on to the caller, which may refuse it', () => {
    const onCancel = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <CardDialog name="decision" title="Attack of opportunity" onCancel={onCancel}>
        <p>The page</p>
      </CardDialog>,
    );

    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));

    expect(onCancel).toHaveBeenCalledOnce();
  });
});

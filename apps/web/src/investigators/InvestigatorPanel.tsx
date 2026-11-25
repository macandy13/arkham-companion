import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type BoardView,
  type InvestigatorId,
  type InvestigatorView,
  type MapEnemyView,
} from '@arkham/engine';
import { range } from '@arkham/util';
import { useCardPicture } from '../catalog/cardImages';
import { classOf, type PrintedInvestigator, type WeaknessDef } from '@arkham/carddata';
import { InvestigatorFace, type InvestigatorFaceShape } from './InvestigatorFace';
import { PlayArea } from './PlayArea';
import { ThreatArea } from './ThreatArea';
import { TurnControls } from './TurnControls';
import { DrawWeakness } from './DrawWeakness';
import { InvestigatorCard, WholeCard } from './InvestigatorCard';
import { usePlay } from '../screens/PlayContext';
import { Counters, statusLine } from './Counters';
import { Skills } from './Skills';

/**
 * One investigator: their threat area along the top edge of their card, the card drawn as the top
 * of the printed one (`InvestigatorFace`) with the name and subname on its plates, the four skills
 * on their chain and the counters on a strip of its notebook page. The players hold the card
 * itself, so its abilities and flavour stay off the screen to leave the board its room; a tap on
 * the art shows the whole card with its text (`InvestigatorCard`). Then where they are and how their round goes, the
 * cards they control (`PlayArea`) and their turn controls. Before where they are, a pentagon marks
 * the lead investigator, like the game's lead investigator token; whose turn it is needs no
 * marker, since only their turn controls carry the action arrows. Health and sanity show what is left of the printed value, like
 * the dials, while the damage and horror taken lie on them like the tokens on the card.
 */
export function InvestigatorPanel({
  board,
  investigator,
  printed,
  weaknesses,
  onMoveByCard,
  seat,
  focused,
  onShown,
  onOpen,
  shape,
  whole,
  onTurn,
  lead,
  engaged,
  canStart,
}: {
  /** The board the skill tests (`SkillTestDialog`) and the card actions (`TurnControls`) read. */
  board: BoardView;
  investigator: InvestigatorView;
  /** What their card prints besides its stats: the subname and class, once the catalog has them. */
  printed: PrintedInvestigator | undefined;
  /** The weaknesses the whole card offers to draw (`DrawWeakness`). */
  weaknesses: readonly WeaknessDef[] | undefined;
  /** Starts picking where a card effect moves them (`InvestigatorBar`'s `onMoveByCard`). */
  onMoveByCard: ((investigator: InvestigatorId) => void) | undefined;
  /**
   * Where the panel sits on the phone's row of panels, which its dots show, so the players see
   * there is more to swipe to; nothing elsewhere, or in a solo game.
   */
  seat: { at: number; of: number } | undefined;
  /** The phone shows this panel in full (`useFocus`). */
  focused: boolean;
  /** The players swiped this panel into view, on the phone's row of panels (`useSwipedTo`). */
  onShown: (() => void) | undefined;
  /** Opens the phone's detail view on this panel, from a tap on the name. */
  onOpen: ((investigator: InvestigatorId) => void) | undefined;
  /** The card's shape: the phone's compact view has room for the slim strip only. */
  shape: InvestigatorFaceShape;
  /** The whole card shows in place of the compact one, with nothing left to open from its art. */
  whole: boolean;
  onTurn: boolean;
  /** They are the lead investigator (`BoardView.lead`). */
  lead: boolean;
  /** The enemies engaged with the investigator, shown in their threat area. */
  engaged: readonly MapEnemyView[];
  /** The players may start this investigator's turn now (`TurnControls`). */
  canStart: boolean;
}) {
  const { busy } = usePlay();
  const { t } = useTranslation();
  const nameId = useId();
  const picture = useCardPicture(investigator.image, 'landscape');
  const [zoomed, setZoomed] = useState(false);
  const section = useSwipedTo(focused, onShown);
  const stats = (
    <>
      <Skills board={board} investigator={investigator} />
      <Counters board={board} investigator={investigator} />
    </>
  );
  // What a player card can do to the investigator that the panel has no control for.
  const canMoveByCard = onMoveByCard !== undefined && investigator.status === 'active';
  const cardEffects = ((weaknesses?.length ?? 0) > 0 || canMoveByCard) && (
    <footer data-part="card-effects">
      <DrawWeakness investigator={investigator} weaknesses={weaknesses} />
      {canMoveByCard && (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setZoomed(false);
            onMoveByCard(investigator.id);
          }}
        >
          {t('moveByCard.start')}
        </button>
      )}
    </footer>
  );
  return (
    <section
      ref={section}
      aria-labelledby={nameId}
      data-status={investigator.status}
      data-turn={onTurn || undefined}
      data-focus={focused || undefined}
      data-investigator={investigator.id}
    >
      {seat && (
        <ol aria-hidden="true" data-dots="investigators">
          {range(seat.of).map((other) => (
            <li key={other} data-current={other === seat.at || undefined} />
          ))}
        </ol>
      )}
      <ThreatArea
        board={board}
        investigator={investigator}
        treacheries={board.cardsIn({ kind: 'threatArea', investigatorId: investigator.id })}
        enemies={engaged}
      />
      {whole ? (
        <>
          <WholeCard
            investigator={investigator}
            printed={printed}
            picture={picture}
            nameId={nameId}
          >
            {stats}
          </WholeCard>
          {cardEffects}
        </>
      ) : (
        <article
          data-card="investigator"
          data-picture={picture?.shown ? 'shown' : undefined}
          data-shape={shape}
        >
          <InvestigatorFace
            picture={picture}
            investigatorClass={classOf(printed?.factionCode)}
            shape={shape}
          />
          <button
            type="button"
            data-full-card=""
            aria-label={t('investigators.showCard', { name: investigator.name })}
            onClick={() => setZoomed(true)}
          />
          <header>
            <h3 id={nameId}>
              {onOpen ? (
                <button type="button" onClick={() => onOpen(investigator.id)}>
                  {investigator.name}
                </button>
              ) : (
                investigator.name
              )}
            </h3>
            {printed?.subname && <p>{printed.subname}</p>}
          </header>
          {stats}
        </article>
      )}
      {zoomed && (
        <InvestigatorCard
          investigator={investigator}
          printed={printed}
          picture={picture}
          onClose={() => setZoomed(false)}
          footer={cardEffects}
        >
          <Skills board={board} investigator={investigator} />
          <Counters board={board} investigator={investigator} />
        </InvestigatorCard>
      )}
      <p data-whereabouts="">
        {lead && <span role="img" aria-label={t('investigators.lead')} data-marker="lead" />}
        <span>{statusLine(investigator, onTurn, t)}</span>
      </p>
      <PlayArea
        board={board}
        investigator={investigator}
        cards={board.cardsIn({ kind: 'playArea', investigatorId: investigator.id })}
      />
      <TurnControls board={board} investigator={investigator} onTurn={onTurn} canStart={canStart} />
    </section>
  );
}

/**
 * The phone's row of panels, one a screen wide, which the players swipe between: once a panel is
 * mostly in view (`SHOWN_SHARE`) it tells `onShown`, which focuses it, and a panel focused
 * otherwise (the turn moved on) scrolls into view at once, so the row passes no panel between on
 * its way, which would take the focus. Without `onShown` (a wider screen, or the phone's expanded
 * bar, whose dots follow the row themselves) it does nothing. Returns the panel's ref.
 */
function useSwipedTo(focused: boolean, onShown: (() => void) | undefined) {
  const section = useRef<HTMLElement>(null);
  const shown = useRef(onShown);
  const carousel = onShown !== undefined;
  useLayoutEffect(() => {
    shown.current = onShown;
  });
  useLayoutEffect(() => {
    if (carousel && focused)
      section.current?.scrollIntoView?.({ block: 'nearest', inline: 'start', behavior: 'instant' });
  }, [carousel, focused]);
  const focusedNow = useRef(focused);
  useLayoutEffect(() => {
    focusedNow.current = focused;
  });
  useEffect(() => {
    const panel = section.current;
    const row = panel?.parentElement;
    // jsdom has no IntersectionObserver; without one the row only follows the turn.
    if (!carousel || !panel || !row || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !focusedNow.current) shown.current?.();
      },
      { root: row, threshold: SHOWN_SHARE },
    );
    observer.observe(panel);
    return () => observer.disconnect();
  }, [carousel]);
  return section;
}

/** How much of a panel must be in view on the phone's row for it to take the focus. */
const SHOWN_SHARE = 0.6;

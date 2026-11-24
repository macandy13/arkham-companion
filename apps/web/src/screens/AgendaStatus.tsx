import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { type BoardView } from '@arkham/engine';
import { CardActions, cardActionsOn } from './ActionRow';
import { Token } from './Token';
import type { HeaderCardKind } from './useDetailView';
import { usePlay } from './PlayContext';
import { HeaderSlot, HeaderCard, BookDetails } from './HeaderSlot';

/**
 * The current agenda as a landscape card (`data-card`, styled like the map's card faces): its
 * name and a big doom token with the doom its threshold counts (all doom in play, `doomInPlay`); a
 * double tap opens the − / + bubble of the doom on the agenda itself, which card effects add or
 * the players correct.
 * It takes doom dropped on it: from the token pool (`TokenPool`), or moved off a location.
 */
export function AgendaStatus({
  board,
  full,
  onOpen,
}: {
  board: BoardView;
  full: boolean;
  onOpen: ((card: HeaderCardKind) => void) | undefined;
}) {
  const { actions, busy } = usePlay();
  const { t } = useTranslation();
  const [zoomed, setZoomed] = useState(false);
  const { agenda } = board;
  if (!agenda) return null;
  const close = () => setZoomed(false);
  const offered = cardActionsOn(board, agenda.id);
  const actionRow = offered.length > 0 && (
    <CardActions board={board} offered={offered} onUse={close} />
  );
  const doomToken = (
    <Token
      kind="doom"
      count={board.doomInPlay}
      threshold={agenda.threshold}
      label={
        agenda.threshold === undefined
          ? t('header.doom', { doom: board.doomInPlay })
          : t('header.doomOf', { doom: board.doomInPlay, threshold: agenda.threshold })
      }
    />
  );
  const counter = t('header.doomCount');
  const bubble = {
    title: t('header.counterBubble', { card: agenda.name, counter }),
    counts: [
      {
        label: counter,
        value: String(agenda.doom),
        lower: { label: t('header.removeDoom'), disabled: busy || agenda.doom === 0 },
        raise: { label: t('header.addDoom'), disabled: busy },
        onStep: (delta: -1 | 1) => void actions.adjustTokens(agenda.id, 'doom', delta),
      },
    ],
  };

  return (
    <HeaderSlot label={t('header.agenda')} card="agenda" onOpen={onOpen}>
      <HeaderCard
        kind="agenda"
        name={agenda.name}
        image={agenda.image}
        set={agenda.encounterSet}
        threshold={agenda.threshold}
        onOpen={full ? undefined : () => setZoomed(true)}
        bubble={bubble}
      >
        {doomToken}
      </HeaderCard>
      {full && actionRow && <footer>{actionRow}</footer>}
      {zoomed && !full && (
        <BookDetails
          kind="agenda"
          board={board}
          card={board.cardFace(agenda.id)}
          threshold={agenda.threshold}
          token={doomToken}
          value={{
            name: t('header.doomName'),
            count: board.doomInPlay,
            ...(agenda.threshold === undefined ? {} : { threshold: agenda.threshold }),
          }}
          onClose={close}
        />
      )}
    </HeaderSlot>
  );
}

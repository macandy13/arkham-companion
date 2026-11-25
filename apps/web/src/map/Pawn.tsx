import { useTranslation } from 'react-i18next';
import type { BoardView, InvestigatorView } from '@arkham/engine';
import { INVESTIGATOR_AVATAR, LANDSCAPE_SCAN } from '../catalog/cardArt';
import { CONTENT, leadMarkerPoints, type Point } from './mapLayout';
import { dragAttributes, type DragHandlers } from './usePieceDrag';
import { TokenPicture } from './TokenPicture';

/** Who leads and whose turn it is, which the pawns show (`BoardView.lead`, `BoardView.turn`). */
export type TurnOrder = Pick<BoardView, 'lead' | 'turn'>;

/**
 * An investigator's pawn (`data-pawn`, their id): a circle with their initial, centred on `centre`, and
 * over it their face from their card's picture once loaded (`TokenPicture`). The
 * `lead` investigator's pawn carries a pentagon like the game's lead investigator token, and the
 * pawn of the investigator whose turn it is (`onTurn`, `data-turn`) a bolder ring; both are also
 * in its name. With `drag` it can be dragged (`usePieceDrag`); a `ghost` is the copy that follows
 * the pointer.
 */
export function Pawn({
  investigator,
  centre,
  lead = false,
  onTurn = false,
  drag,
  ghost = false,
}: {
  investigator: InvestigatorView;
  centre: Point;
  lead?: boolean;
  onTurn?: boolean;
  drag?: DragHandlers;
  ghost?: boolean;
}) {
  const { t } = useTranslation();
  const { x, y } = centre;
  const name = [
    investigator.name,
    ...(lead ? [t('map.lead')] : []),
    ...(onTurn ? [t('map.onTurn')] : []),
  ].join(', ');
  return (
    <g
      data-pawn={investigator.id}
      data-turn={onTurn || undefined}
      {...dragAttributes({ name, kind: 'pawn', drag, ghost })}
    >
      <circle cx={x} cy={y} r={CONTENT.pawnRadius} />
      <text x={x} y={y}>
        {investigator.name.charAt(0)}
      </text>
      <TokenPicture
        image={investigator.image}
        area={INVESTIGATOR_AVATAR}
        scan={LANDSCAPE_SCAN}
        centre={centre}
        radius={CONTENT.pawnRadius}
      />
      {lead && (
        <polygon
          data-marker="lead"
          points={leadMarkerPoints(centre)
            .map((corner) => `${corner.x},${corner.y}`)
            .join(' ')}
        />
      )}
    </g>
  );
}

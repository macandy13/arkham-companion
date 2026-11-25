import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  cardImagePath,
  cardName,
  type BoardView,
  type CardImagePath,
  type ReferenceView,
} from '@arkham/engine';
import type { CardCatalog, ReferenceSideTexts } from '@arkham/carddata';
import type { ShownCard } from '../catalog/cardFace';
import { useCardPicture } from '../catalog/cardImages';
import { cardText } from '../catalog/cardText';
import type { OpenGame } from '../state/appStore';
import { CardDialog } from './CardDialog';
import { ChaosBag } from './ChaosBag';
import { ScenarioFace } from './ScenarioFace';

/**
 * What the card catalog has for the side of the scenario reference card a game plays with
 * (`BoardView.reference`): its printed texts and its picture (`ReferencePictures`), each absent
 * until the catalog has loaded or when the card data has none.
 */
export interface PrintedReference {
  texts?: ReferenceSideTexts;
  picture?: CardImagePath;
}

/** What `catalog` has for the side of the reference card that `reference` names (`PrintedReference`). */
export function printedReferenceOf(
  catalog: CardCatalog,
  reference: ReferenceView,
): PrintedReference {
  const { code, side } = reference;
  const picture = catalog.referencePictures?.[code]?.[side];
  return {
    texts: catalog.references?.[code]?.[side],
    picture: picture === undefined ? undefined : cardImagePath(picture),
  };
}

/**
 * The scenario as an upright card, like the reference card on the table (`ScenarioCard`). Its name
 * (`OpenGame.scenarioNameKey`) is the screen's heading, since the play screen shows no app title:
 * the scenario is what the players are playing. Where the card `opens`, a tap on it, or on its
 * name, which is a button for the keyboard, opens it as a full card to read its rows.
 */
export function ScenarioStatus({
  open,
  board,
  printed,
  opens,
}: {
  open: OpenGame;
  board: BoardView;
  printed: PrintedReference | undefined;
  opens: boolean;
}) {
  const { t } = useTranslation();
  const [zoomed, setZoomed] = useState(false);
  const name = open.scenarioNameKey ? t(open.scenarioNameKey) : t('header.scenario');
  const zoom = () => setZoomed(true);
  return (
    <>
      <ScenarioCard
        reference={board.reference}
        printed={printed}
        onClick={opens ? zoom : undefined}
      >
        <h1>
          {opens ? (
            <button type="button" onClick={zoom}>
              {name}
            </button>
          ) : (
            name
          )}
        </h1>
      </ScenarioCard>
      {zoomed && (
        <ScenarioDetails
          board={board}
          name={name}
          printed={printed}
          onClose={() => setZoomed(false)}
        />
      )}
    </>
  );
}

/**
 * The scenario reference card opened from the header (`ScenarioStatus`), on the card shell
 * (`CardDialog`, MD.6b3):
 * - the upright card beside the page, the same face as in the header, tapped to read it whole;
 * - "Scenario" and the side the game's difficulty plays with as the kicker, its name as the title;
 * - on the page the cards set aside and the victory points so far (`BoardView.victoryPoints`);
 * - one row per symbol token at the page's print size, the token beside its printed text, since
 *   on the card they stay too small to read on a tablet;
 * - the chaos bag, where the players seal and release tokens (`ChaosBag`).
 * The card is no instance in play (`BoardView.reference`), so the shell shows it as a `ShownCard`
 * built from its name and picture. Escape and its × close it.
 */
function ScenarioDetails({
  board,
  name,
  printed,
  onClose,
}: {
  board: BoardView;
  name: string;
  printed: PrintedReference | undefined;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { reference } = board;
  const card: ShownCard = {
    // The scenario's display name: the reference card prints it, and the game holds no card name.
    name: cardName(name),
    type: 'scenario',
    traits: [],
    ...(printed?.picture === undefined ? {} : { image: printed.picture }),
  };
  return (
    <CardDialog
      name="scenario"
      card={card}
      drawn={
        <ScenarioCard reference={reference} printed={printed} decorative>
          {/* Inside the card's button, so its name is no second heading; the page's title is. */}
          <span data-part="name">{name}</span>
        </ScenarioCard>
      }
      kicker={
        reference
          ? t('header.scenarioSide', { side: t(`header.referenceSide.${reference.side}`) })
          : t('header.scenario')
      }
      title={name}
      onCancel={onClose}
      onClose={onClose}
    >
      <dl>
        <div>
          <dt>{t('header.setAsideName')}</dt>
          <dd>{board.cardsIn({ kind: 'setAside' }).length}</dd>
        </div>
        <div>
          <dt>{t('header.victory')}</dt>
          <dd>{board.victoryPoints}</dd>
        </div>
      </dl>
      {reference && <ReferenceRows reference={reference} printed={printed} />}
      <ChaosBag board={board} />
    </CardDialog>
  );
}

/**
 * The reference card's rows, one per symbol token: the token's game symbol (named for screen
 * readers) beside its printed text (`printed`, from the card catalog, for the side
 * `BoardView.reference` names), on the card's face and, larger, on its dialog's page.
 */
function ReferenceRows({
  reference,
  printed,
}: {
  reference: ReferenceView;
  printed: PrintedReference | undefined;
}) {
  const { t } = useTranslation();
  return (
    <ul aria-label={t('header.reference')}>
      {reference.rows.map(({ token }) => {
        const text = printed?.texts?.[token];
        return (
          <li key={token} data-chaos-token={token}>
            <span role="img" aria-label={t(`chaosToken.${token}`)} />
            {text !== undefined && <p>{cardText(text)}</p>}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The face of the scenario reference card: in the Exact card theme our drawing of its frame
 * (`ScenarioFace`) under its title (`children`), the side the game's difficulty plays with and one
 * row per symbol token, the token's game symbol (named for screen readers) beside its printed
 * text (`printed`, from the card catalog, for the side `BoardView.reference` names). A game without
 * a reference card shows only the title. In the card pictures theme the side's picture lies over
 * it all once loaded (`data-picture`), and the stylesheet hides what the picture prints; the
 * rows stay beneath it for assistive technology. Drawn as a dialog's card (`decorative`), whose
 * page repeats its rows, it is hidden from assistive technology.
 */
function ScenarioCard({
  reference,
  printed,
  onClick,
  decorative = false,
  children,
}: {
  reference: ReferenceView | undefined;
  printed: PrintedReference | undefined;
  onClick?: () => void;
  decorative?: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const picture = useCardPicture(printed?.picture, 'portrait');
  return (
    <div
      data-card="scenario"
      data-picture={picture?.shown ? 'shown' : undefined}
      aria-hidden={decorative || undefined}
      onClick={
        onClick &&
        ((event) => {
          if (!(event.target instanceof Element && event.target.closest('button'))) onClick();
        })
      }
    >
      <ScenarioFace set={reference?.encounterSet} />
      {children}
      {reference && (
        <>
          <p>{t(`header.referenceSide.${reference.side}`)}</p>
          <ReferenceRows reference={reference} printed={printed} />
        </>
      )}
      {picture && (
        <img src={picture.url} alt="" onLoad={picture.onLoad} onError={picture.onError} />
      )}
    </div>
  );
}

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { classOf, type PrintedInvestigator } from '@arkham/carddata';
import type { InvestigatorView } from '@arkham/engine';
import { cardParagraphs } from '../catalog/cardText';
import type { CardPicture } from '../catalog/cardImages';
import { useBackCloses } from '../screens/useBackCloses';
import { InvestigatorFace } from './InvestigatorFace';

/**
 * An investigator's whole card, opened from the art of the play screen's compact card (the
 * tablet's banner or the phone's strip) to read what the compact card leaves out: the printed
 * card's face (`InvestigatorFace`, `full`) with the name on its plates, the skills and counters
 * (`children`, the panel's own, so they read and tap as on the bar) and the traits, abilities and
 * flavour on its notebook page (`printed`, blank until the catalog has them). A native modal
 * `<dialog>` brings focus trapping and Escape; on a phone it fills the screen and the back
 * gesture closes it too (`useBackCloses`), like the card zoom.
 */
export function InvestigatorCard({
  investigator,
  printed,
  picture,
  onClose,
  children,
}: {
  investigator: InvestigatorView;
  printed: PrintedInvestigator | undefined;
  picture: CardPicture | undefined;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const nameId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const close = useBackCloses(onClose);
  return (
    <dialog
      ref={dialog}
      aria-labelledby={nameId}
      onCancel={(event) => {
        // React passes `cancel` on to the dialogs around it, and Escape here closes only the card.
        event.stopPropagation();
        close();
      }}
      data-dialog="investigator-card"
    >
      <button type="button" data-icon="close" aria-label={t('cardZoom.close')} onClick={close} />
      <WholeCard investigator={investigator} printed={printed} picture={picture} nameId={nameId}>
        {children}
      </WholeCard>
    </dialog>
  );
}

/**
 * The whole card itself, as `InvestigatorCard` shows it and the phone's expanded investigator bar
 * in place of the strip: the face drawn `full`, the name (`nameId` names what it labels) and
 * subname on its plates, the skills and counters (`children`) and the notebook page. In the bar
 * the players may be `adjusting` the board, which brings out the counters' steppers.
 */
export function WholeCard({
  investigator,
  printed,
  picture,
  nameId,
  adjusting = false,
  children,
}: {
  investigator: InvestigatorView;
  printed: PrintedInvestigator | undefined;
  picture: CardPicture | undefined;
  nameId: string;
  adjusting?: boolean;
  children: ReactNode;
}) {
  return (
    <article
      data-card="investigator"
      data-picture={picture?.shown ? 'shown' : undefined}
      data-adjusting={adjusting || undefined}
      data-shape="full"
    >
      <InvestigatorFace
        picture={picture}
        investigatorClass={classOf(printed?.factionCode)}
        shape="full"
      />
      <header>
        <h3 id={nameId}>{investigator.name}</h3>
        {printed?.subname && <p>{printed.subname}</p>}
      </header>
      {children}
      {printed && <NotebookPage printed={printed} />}
    </article>
  );
}

/**
 * The text on the card's notebook page, as printed: the traits on the first line, each ability on
 * its own lines (`cardParagraphs`, its symbols as icons), the flavour under them. A long text
 * (some investigators print four abilities) takes a smaller size (`data-length`), so it stays on
 * the page above the counters.
 */
function NotebookPage({ printed }: { printed: PrintedInvestigator }) {
  const { traits, text, flavor } = printed;
  return (
    <div data-page="" data-length={textLength(printed)}>
      {traits && <p data-traits="">{traits}</p>}
      {text && cardParagraphs(text)}
      {flavor && <blockquote>{cardParagraphs(flavor)}</blockquote>}
    </div>
  );
}

/**
 * How much the notebook page holds, so the stylesheet sizes its text to fit: the printed cards
 * keep one size and fit by tighter setting, which plain HTML cannot measure ahead.
 */
type TextLength = 'short' | 'long' | 'longest';

/** The length class of a card's page text, by its characters (Roland Banks' is short). */
export function textLength({ traits, text, flavor }: PrintedInvestigator): TextLength {
  const length = (traits?.length ?? 0) + (text?.length ?? 0) + (flavor?.length ?? 0);
  if (length <= LONG_TEXT) return 'short';
  return length <= LONGEST_TEXT ? 'long' : 'longest';
}

/** The characters from which a page's text is long, or longest (measured on the Core Set cards). */
const LONG_TEXT = 260;
const LONGEST_TEXT = 400;

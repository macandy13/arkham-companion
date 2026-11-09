import type { InvestigatorDef } from '@arkham/carddata';
import { SKILL_NAMES } from '@arkham/engine';
import { Fragment, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { cardParagraphs } from '../catalog/cardText';

interface InvestigatorSheetProps {
  readonly investigator: InvestigatorDef;
  /** The same investigator in the other chapter, when the catalog lists it. */
  readonly otherChapter?: InvestigatorDef;
  /** Seat the investigator already holds (1-based), if any. */
  readonly seatNumber?: number;
  readonly seatsFull: boolean;
  readonly imageUrl: (src: string) => string;
  readonly onSelect: () => void;
  /** Moves the picked investigator to the first seat, the lead investigator's. */
  readonly onMakeLead: () => void;
  readonly onRemove: () => void;
  readonly onShowOtherChapter: () => void;
  readonly onClose: () => void;
}

/**
 * Detail sheet over the picker: both card faces, health, sanity, skills, the card's traits and
 * ability text as a notebook page (ArkhamDB markup, its symbols as icons; readable when the
 * pictures don't load) and the select action, or for a picked investigator their seat with the
 * actions to make them lead or remove them. A native modal `<dialog>` brings focus trapping and
 * Escape; it stays open while it turns to the other chapter's version.
 */
export function InvestigatorSheet({
  investigator,
  otherChapter,
  seatNumber,
  seatsFull,
  imageUrl,
  onSelect,
  onMakeLead,
  onRemove,
  onShowOtherChapter,
  onClose,
}: InvestigatorSheetProps) {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const faces = [investigator.imageSrc, investigator.backImageSrc].filter(
    (src): src is string => src !== undefined,
  );

  return (
    <dialog
      ref={dialog}
      aria-labelledby="picker-sheet-heading"
      onCancel={onClose}
      data-dialog="investigator"
    >
      <header>
        <h3 id="picker-sheet-heading">{investigator.name}</h3>
        <small data-chapter={investigator.chapter}>
          {t('picker.chapterBadge', { n: investigator.chapter })}
        </small>
        <button type="button" data-icon="close" aria-label={t('picker.close')} onClick={onClose} />
      </header>
      {investigator.subname && <p>{investigator.subname}</p>}
      <figure>
        {faces.map((src, index) => (
          <img
            key={src}
            src={imageUrl(src)}
            alt={t(index === 0 ? 'picker.front' : 'picker.back')}
          />
        ))}
      </figure>
      <dl>
        <dt>{t('picker.health')}</dt>
        <dd>{investigator.health}</dd>
        <dt>{t('picker.sanity')}</dt>
        <dd>{investigator.sanity}</dd>
        {SKILL_NAMES.map((skill) => (
          <Fragment key={skill}>
            <dt>{t(`skill.${skill}`)}</dt>
            <dd>{investigator.skills[skill]}</dd>
          </Fragment>
        ))}
      </dl>
      {(investigator.traits || investigator.text) && (
        <section aria-label={t('picker.cardText')} data-page="">
          {investigator.traits && <p data-traits="">{investigator.traits}</p>}
          {investigator.text && cardParagraphs(investigator.text)}
        </section>
      )}
      {otherChapter && (
        <button type="button" onClick={onShowOtherChapter}>
          {t('picker.otherChapter', { n: otherChapter.chapter })}
        </button>
      )}
      {seatNumber === undefined ? (
        <button type="button" disabled={seatsFull} onClick={onSelect}>
          {t('picker.select')}
        </button>
      ) : (
        <footer>
          <p>{t(seatNumber === 1 ? 'picker.lead' : 'picker.seated', { n: seatNumber })}</p>
          {seatNumber > 1 && (
            <button type="button" onClick={onMakeLead}>
              {t('picker.makeLead')}
            </button>
          )}
          <button type="button" onClick={onRemove}>
            {t('picker.remove')}
          </button>
        </footer>
      )}
    </dialog>
  );
}

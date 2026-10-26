import type { InvestigatorDef } from '@arkham/carddata';
import { SKILL_NAMES } from '@arkham/engine';
import { Fragment, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

interface InvestigatorSheetProps {
  readonly investigator: InvestigatorDef;
  /** The same investigator in the other chapter, when the catalog lists it. */
  readonly otherChapter?: InvestigatorDef;
  /** Seat the investigator already holds (1-based), if any. */
  readonly seatNumber?: number;
  readonly seatsFull: boolean;
  readonly imageUrl: (src: string) => string;
  readonly onSelect: () => void;
  readonly onShowOtherChapter: () => void;
  readonly onClose: () => void;
}

/**
 * Detail sheet over the picker: both card faces, health, sanity, skills and the select action. A
 * native modal `<dialog>` brings focus trapping and Escape; it stays open while it turns to the
 * other chapter's version.
 */
export function InvestigatorSheet({
  investigator,
  otherChapter,
  seatNumber,
  seatsFull,
  imageUrl,
  onSelect,
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
      {otherChapter && (
        <button type="button" onClick={onShowOtherChapter}>
          {t('picker.otherChapter', { n: otherChapter.chapter })}
        </button>
      )}
      <button type="button" disabled={seatNumber !== undefined || seatsFull} onClick={onSelect}>
        {seatNumber === undefined ? t('picker.select') : t('picker.seated', { n: seatNumber })}
      </button>
    </dialog>
  );
}

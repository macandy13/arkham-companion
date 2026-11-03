import type { CardCatalog } from '@arkham/carddata';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InvestigatorPicker } from '../picker/InvestigatorPicker';

/**
 * The investigator picker for one killed or insane team member's seat (MC1.6d3), over the setup
 * preview: `catalog` holds only the investigators who may replace them (`replacementCandidates`),
 * and the picker takes one, which "Choose" hands to `onChoose`.
 */
export function ReplacementPicker({
  name,
  catalog,
  onChoose,
  onCancel,
}: {
  /** The replaced member's name, for the title. */
  readonly name: string;
  readonly catalog: CardCatalog;
  readonly onChoose: (code: string) => void;
  readonly onCancel: () => void;
}) {
  const { t } = useTranslation();
  const dialog = useRef<HTMLDialogElement>(null);
  const [seats, setSeats] = useState<string[]>([]);
  const [chosen] = seats;

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialog}
      id="replacement-picker"
      aria-labelledby="replacement-picker-title"
      onCancel={onCancel}
    >
      <h2 id="replacement-picker-title">{t('nextScenario.replace.title', { name })}</h2>
      {/* No form: the picker's own buttons would submit it. */}
      <InvestigatorPicker catalog={catalog} seats={seats} onSeatsChange={setSeats} maxSeats={1} />
      <footer>
        <button type="button" onClick={onCancel}>
          {t('games.cancel')}
        </button>
        <button
          type="button"
          data-primary
          disabled={chosen === undefined}
          onClick={() => {
            if (chosen !== undefined) onChoose(chosen);
          }}
        >
          {t('nextScenario.replace.choose')}
        </button>
      </footer>
    </dialog>
  );
}

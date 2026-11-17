import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { WeaknessDef } from '@arkham/carddata';
import type { InvestigatorView } from '@arkham/engine';
import type { GameActions } from '../state/gameActions';
import { weaknessGroups } from './weakness_groups';

/**
 * "Draw a weakness" on an investigator's whole card: the players drew a weakness enemy or
 * treachery from their deck (Mob Enforcer, Haunted), so the app puts it into play
 * (`GameActions.drawWeakness`) and it resolves like an encounter card. The button opens a dialog
 * to pick it from the catalog's `weaknesses` (`DrawWeaknessDialog`). Nothing until the catalog has
 * them.
 */
export function DrawWeakness({
  investigator,
  weaknesses,
  actions,
  busy,
}: {
  investigator: InvestigatorView;
  weaknesses: readonly WeaknessDef[] | undefined;
  actions: GameActions;
  busy: boolean;
}) {
  const { t } = useTranslation();
  const [picking, setPicking] = useState(false);
  if (weaknesses === undefined || weaknesses.length === 0) return null;
  return (
    <>
      <button type="button" disabled={busy} onClick={() => setPicking(true)}>
        {t('weakness.draw')}
      </button>
      {picking && (
        <DrawWeaknessDialog
          investigator={investigator}
          weaknesses={weaknesses}
          onDraw={(card) => void actions.drawWeakness(investigator.id, card.code)}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  );
}

/**
 * The weaknesses to pick from, grouped (`weaknessGroups`: the investigator's own first, then the
 * basic ones, then other investigators') under a search box that narrows them by name. A native
 * modal `<dialog>`; Escape closes only it, not the card it opened from, and it doesn't take the
 * phone's back step (`useBackCloses`), which would close that card too.
 */
function DrawWeaknessDialog({
  investigator,
  weaknesses,
  onDraw,
  onClose,
}: {
  investigator: InvestigatorView;
  weaknesses: readonly WeaknessDef[];
  onDraw: (card: WeaknessDef) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const [search, setSearch] = useState('');
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const groups = weaknessGroups(weaknesses, investigator.code, search);
  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      data-dialog="draw-weakness"
      onCancel={(event) => {
        // React passes `cancel` on to the dialogs around it, and Escape here closes only this one.
        event.stopPropagation();
        onClose();
      }}
    >
      <h2 id={titleId}>{t('weakness.drawFor', { investigator: investigator.name })}</h2>
      <input
        type="search"
        aria-label={t('weakness.search')}
        placeholder={t('weakness.search')}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {groups.map(({ group, cards }) => (
        <section key={group} aria-label={t(`weakness.group.${group}`)}>
          <h3>{t(`weakness.group.${group}`)}</h3>
          <ul>
            {cards.map((card) => (
              <li key={card.code}>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onDraw(card);
                  }}
                >
                  {card.name}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {groups.length === 0 && <p>{t('weakness.none')}</p>}
      <footer>
        <button type="button" onClick={onClose}>
          {t('games.cancel')}
        </button>
      </footer>
    </dialog>
  );
}

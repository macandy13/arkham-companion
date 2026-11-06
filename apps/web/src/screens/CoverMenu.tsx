import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/** One entry of a cover's ⋮ menu. */
export interface CoverAction {
  readonly label: string;
  readonly onSelect: () => void;
}

/**
 * A cover's ⋮ menu at the end of its foot (MD.3b): a round icon button that opens its actions
 * under it, drawn by base.css's menu rule. Choosing an action closes it again.
 */
export function CoverMenu({
  title,
  actions,
}: {
  /** The cover's title, which names the menu among the shelf's other covers. */
  readonly title: string;
  readonly actions: readonly CoverAction[];
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <button
        type="button"
        data-icon="more"
        aria-label={t('home.more', { title })}
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
      />
      {expanded && (
        <ul>
          {actions.map(({ label, onSelect }) => (
            <li key={label}>
              <button
                type="button"
                onClick={() => {
                  setExpanded(false);
                  onSelect();
                }}
              >
                {label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

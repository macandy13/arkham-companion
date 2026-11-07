import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/** The line icons a cover's menu entries take (base.css draws each). */
export type CoverActionIcon = 'campaign-log' | 'rename' | 'duplicate' | 'export' | 'delete';

/** One entry of a cover's ⋮ menu. */
export interface CoverAction {
  readonly label: string;
  readonly icon: CoverActionIcon;
  readonly onSelect: () => void;
}

/**
 * A cover's ⋮ menu at the end of its foot (MD.3b): a round icon button that opens its actions
 * under it, drawn by base.css's menu rule, each with its line icon and Delete in red. Choosing an
 * action closes it again.
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
          {actions.map(({ label, icon, onSelect }) => (
            <li key={label}>
              <button
                type="button"
                data-icon={icon}
                data-danger={icon === 'delete' || undefined}
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

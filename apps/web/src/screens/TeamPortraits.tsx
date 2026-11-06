import type { CardImagePath } from '@arkham/engine';
import { useTranslation } from 'react-i18next';
import { InvestigatorArt } from '../investigators/InvestigatorArt';

/**
 * Where each investigator's card picture is, by investigator code, from the card catalog once it
 * has loaded; empty until then, so the portraits show their initials meanwhile.
 */
export type PortraitImages = ReadonlyMap<string, CardImagePath>;

/**
 * A cover's team as one row of round portraits (MD.3b): each investigator's art cut from their
 * card's picture, or their initial until it loads and for good when it fails. The names stay for
 * screen readers; the stylesheet hides them beside the faces.
 */
export function TeamPortraits({
  team,
  images,
}: {
  readonly team: readonly { readonly code: string; readonly name: string }[];
  readonly images: PortraitImages;
}) {
  const { t } = useTranslation();
  return (
    <ul aria-label={t('home.team')}>
      {team.map(({ code, name }) => (
        <li key={code} data-initial={name.slice(0, 1)}>
          <InvestigatorArt image={images.get(code)} />
          <span>{name}</span>
        </li>
      ))}
    </ul>
  );
}

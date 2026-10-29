import type { CardImagePath } from '@arkham/engine';
import { useCardPicture } from '../catalog/cardImages';

/**
 * The art of an investigator card (`InvestigatorView.image`): the part of the picture of its front
 * where the printed card has its art, cut out by the stylesheet once the picture has loaded
 * (`data-picture`); until then, and for good when it fails, its place shows what lies under it
 * (the panel's hatched art window, an avatar's initial). Shared by the investigator panels, their
 * avatars and the clue payment dialog.
 */
export function InvestigatorArt({ image }: { image: CardImagePath | undefined }) {
  const picture = useCardPicture(image);
  return (
    <picture data-picture={picture?.shown ? 'shown' : undefined}>
      {picture && (
        <img src={picture.url} alt="" onLoad={picture.onLoad} onError={picture.onError} />
      )}
    </picture>
  );
}

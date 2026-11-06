import type { ScenarioId } from '@arkham/engine';
import { AGENDA_ART, LANDSCAPE_SCAN, artViewBox } from '../catalog/cardArt';
import { useCardPicture } from '../catalog/cardImages';
import { findScenario } from '../scenarios/scenarioCatalog';

/**
 * The art band at the top of a home cover (MD.3b): the art of the first agenda of `scenarioId`,
 * the same crop the play screen's agenda shows, filling the band. The picture comes from ArkhamDB
 * on the device and shows once it has loaded (`data-picture`); until then, and for good offline
 * or for a scenario without a picture, the band stays plain paper. Decoration only.
 */
export function CoverArt({ scenarioId }: { readonly scenarioId: ScenarioId | undefined }) {
  const scenario = scenarioId ? findScenario(scenarioId) : undefined;
  const agenda = scenario?.definition.agendaDeck[0];
  const picture = useCardPicture(
    agenda ? scenario?.cards.get(agenda)?.imageSrc : undefined,
    'landscape',
  );
  return (
    <svg
      viewBox={artViewBox(AGENDA_ART, LANDSCAPE_SCAN)}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      data-picture={picture?.shown ? 'shown' : undefined}
    >
      {picture && (
        <image
          href={picture.url}
          {...LANDSCAPE_SCAN}
          preserveAspectRatio="none"
          onLoad={picture.onLoad}
          onError={picture.onError}
        />
      )}
    </svg>
  );
}

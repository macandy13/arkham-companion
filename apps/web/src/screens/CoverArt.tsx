import { useState } from 'react';
import type { ScenarioId } from '@arkham/engine';
import { AGENDA_ART, LANDSCAPE_SCAN, artViewBox } from '../catalog/cardArt';
import { useCardPicture } from '../catalog/cardImages';
import { findScenario } from '../scenarios/scenarioCatalog';

/** The size of a campaign's key art (`campaignKeyArt`), the 16:9 of FFG's product pages. */
const KEY_ART = { width: 1920, height: 1080 } as const;

/**
 * The art band at the top of a home cover (MD.3b). A campaign's cover shows its box's key art
 * (`keyArt`); under it, and alone on a game's cover, lies the art of the first agenda of
 * `scenarioId`, the same crop the play screen's agenda shows. Each picture comes from the web on
 * the device and shows once it has loaded (`data-picture`), so the agenda art stands in while the
 * key art loads or when it can't (offline, where the service worker still has the agenda's), and
 * the band stays plain paper while neither has. Decoration only; `data-cover-art` takes the band's
 * look from base.css, and each place sets its size.
 */
export function CoverArt({
  scenarioId,
  keyArt,
}: {
  readonly scenarioId: ScenarioId | undefined;
  readonly keyArt?: string;
}) {
  const scenario = scenarioId ? findScenario(scenarioId) : undefined;
  const agenda = scenario?.definition.agendaDeck[0];
  const picture = useCardPicture(
    agenda ? scenario?.cards.get(agenda)?.imageSrc : undefined,
    'landscape',
  );
  const [loadedKeyArt, setLoadedKeyArt] = useState<string>();
  const keyArtShown = keyArt !== undefined && loadedKeyArt === keyArt;
  const shown = (isShown: boolean) => (isShown ? 'shown' : undefined);
  return (
    <svg aria-hidden="true" data-cover-art="" data-picture={shown(keyArtShown || !!picture?.shown)}>
      <svg
        width="100%"
        height="100%"
        viewBox={artViewBox(AGENDA_ART, LANDSCAPE_SCAN)}
        preserveAspectRatio="xMidYMid slice"
        data-picture={shown(!!picture?.shown)}
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
      {keyArt && (
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${KEY_ART.width} ${KEY_ART.height}`}
          preserveAspectRatio="xMidYMid slice"
          data-picture={shown(keyArtShown)}
        >
          <image
            href={keyArt}
            {...KEY_ART}
            onLoad={() => setLoadedKeyArt(keyArt)}
            onError={() => setLoadedKeyArt(undefined)}
          />
        </svg>
      )}
    </svg>
  );
}

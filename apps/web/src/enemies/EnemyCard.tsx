import { useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { EnemyStatsView, Keyword, MapEnemyView } from '@arkham/engine';
import { sentences } from '@arkham/util';
import { ENEMY_ART, PORTRAIT_SCAN, artViewBox } from '../catalog/cardArt';
import {
  Brain,
  CARD_OUTLINE,
  CountCircle,
  Heart,
  NightSky,
  OrnamentLine,
  SetMedallion,
} from '../catalog/cardFace';
import { useCardPicture } from '../catalog/cardImages';
import { cardText } from '../catalog/cardText';
import type { Point } from '../map/mapLayout';
import { shrinkAround, useShrinkToFit } from '../map/useShrinkToFit';
import { ENEMY_FACE, ENEMY_FRAME } from './enemyCardFrame';
import { healthLeft } from './enemyHealth';

/** The hatch's cell in scan units, as on the location tiles' art while they have no picture. */
const HATCH = 40;

/** A stat an enemy card prints on a chevron. */
type Stat = 'fight' | 'health' | 'evade';

/**
 * An enemy drawn as its card in the Exact card theme, in scan units, laid out as the printed enemy
 * card (`ENEMY_FACE`, our own drawing of it, no FFG art): the name on the plate, fight, health and
 * evade on chevrons hanging from the frame with the damage dealt as the count circle on the health
 * (`CountCircle`), the scrolls of the frame, its traits, keywords and victory points on the lens in
 * our own words, and its attack as hearts and brains beside the set medallion on the lens's arc,
 * over its art, cut from the card's picture once that has loaded (a hatch until then, and for
 * good offline). In the card pictures theme the whole picture lies over the drawing once loaded,
 * under the damage count alone; the drawing stays beneath it, so it keeps naming the card and its
 * values to assistive technology. The texts are HTML in `foreignObject`s, so they wrap and stay paragraphs.
 */
export function EnemyCard({ enemy, stats }: { enemy: MapEnemyView; stats: EnemyStatsView }) {
  const { t } = useTranslation();
  const clipId = useId();
  const plateId = useId();
  const lensId = useId();
  const hatchId = useId();
  const name = useRef<SVGTextElement>(null);
  const scale = useShrinkToFit(name, ENEMY_FACE.name.width, enemy.name);
  const picture = useCardPicture(stats.image);
  const { width, height } = PORTRAIT_SCAN;
  const art = { x: 0, ...ENEMY_FACE.art, width };
  const damage = enemy.damage ?? 0;
  const values: Record<Stat, string> = {
    fight: `${stats.fight}`,
    health: enemy.health === undefined ? '–' : `${enemy.health}`,
    evade: `${stats.evade}`,
  };
  const left = healthLeft(enemy);
  const labels: Record<Stat, string> = {
    fight: `${t('enemy.fight')} ${values.fight}`,
    health:
      left === undefined
        ? `${t('enemy.health')} –`
        : `${t('enemy.health')} ${left} ${t('enemy.ofMax', { max: enemy.health })}`,
    evade: `${t('enemy.evade')} ${values.evade}`,
  };
  const nameCentre = { x: ENEMY_FACE.name.x, y: ENEMY_FACE.name.y };

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      data-card="enemy"
      data-picture={picture?.shown ? 'shown' : undefined}
    >
      <defs>
        <clipPath id={clipId}>
          <path d={CARD_OUTLINE} />
        </clipPath>
        {/* The stylesheet colours the stops and the hatch, like the location tiles' fills. */}
        <linearGradient id={plateId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" />
          <stop offset="1" />
        </linearGradient>
        <radialGradient id={lensId} cx="0.5" cy="0.45" r="0.7">
          <stop offset="0" />
          <stop offset="1" />
        </radialGradient>
        <pattern id={hatchId} width={HATCH} height={HATCH} patternUnits="userSpaceOnUse">
          <rect width={HATCH} height={HATCH} />
          <path d={`M 0 ${HATCH} L ${HATCH} 0`} />
        </pattern>
      </defs>
      <g clipPath={`url(#${clipId})`} aria-hidden="true">
        <path data-part="art" d={ENEMY_FRAME.art} fill={`url(#${hatchId})`} />
        {picture && (
          <svg {...art} viewBox={artViewBox(ENEMY_ART)} preserveAspectRatio="xMidYMid slice">
            <image
              href={picture.url}
              {...PORTRAIT_SCAN}
              preserveAspectRatio="none"
              onLoad={picture.onLoad}
              onError={picture.onError}
            />
          </svg>
        )}
        <path data-part="lens" d={ENEMY_FRAME.lens} fill={`url(#${lensId})`} />
        <NightSky page={ENEMY_FRAME.lens} />
        <path data-part="watermark" d={ENEMY_FRAME.watermark} />
        <path data-part="setting" d={ENEMY_FRAME.lensSetting} />
        <path data-part="rule" d={ENEMY_FRAME.lensRule} />
        <path data-part="inner-rule" d={ENEMY_FRAME.lensInner} />
        <path data-part="frame" d={ENEMY_FRAME.band} />
        <path data-part="wing" d={ENEMY_FRAME.wing} />
        <path data-part="star" d={ENEMY_FRAME.stars} />
        <path data-part="plate" d={ENEMY_FRAME.plate} fill={`url(#${plateId})`} />
        <path data-part="setting" d={ENEMY_FRAME.plateSetting} />
        <path data-part="rule" d={ENEMY_FRAME.plateRule} />
        {ENEMY_FRAME.scrolls.map((d) => (
          <OrnamentLine key={d} d={d} />
        ))}
        <path data-part="side-star" d={ENEMY_FRAME.sideStars} />
        <path data-part="footer" d={ENEMY_FRAME.footer} />
      </g>
      {(['fight', 'evade', 'health'] as const).map((stat) => (
        <g key={stat} role="img" aria-label={labels[stat]} data-stat={stat}>
          <path data-part="setting" d={ENEMY_FRAME[stat].setting} />
          <path data-part="rim" d={ENEMY_FRAME[stat].rim} />
          <path data-part="fill" d={ENEMY_FRAME[stat].fill} />
          <text
            x={(ENEMY_FACE[stat].left + ENEMY_FACE[stat].right) / 2}
            y={ENEMY_FACE[stat].number}
          >
            {values[stat]}
          </text>
        </g>
      ))}
      <g aria-hidden="true">
        <circle data-part="health-medallion" cx={width / 2} cy={30} r={11} />
        <path data-part="health-star" d={ENEMY_FRAME.healthStar} />
        <StatIcon symbol="combat" centre={ENEMY_FACE.fightIcon} />
        <StatIcon symbol="agility" centre={ENEMY_FACE.evadeIcon} />
      </g>
      <text ref={name} {...nameCentre} transform={shrinkAround(nameCentre, scale)}>
        {enemy.name}
      </text>
      <foreignObject {...ENEMY_FACE.traits}>
        {stats.traits.length > 0 && <p data-part="traits">{sentences(stats.traits)}</p>}
      </foreignObject>
      <foreignObject {...ENEMY_FACE.text}>
        <div data-part="text">
          <KeywordLines keywords={stats.keywords} />
        </div>
      </foreignObject>
      {stats.victory !== undefined && (
        <foreignObject {...ENEMY_FACE.victory}>
          <p data-part="victory">{t('enemy.victory', { points: stats.victory })}</p>
        </foreignObject>
      )}
      <g role="img" aria-label={`${t('enemy.attack')}: ${t('enemy.attackValue', stats.attack)}`}>
        <Attack damage={stats.attack.damage} horror={stats.attack.horror} />
      </g>
      <SetMedallion
        centre={ENEMY_FACE.medallion}
        radius={ENEMY_FACE.medallion.radius}
        plateWidth={ENEMY_FACE.medallion.plateWidth}
        type={t('enemy.type')}
      />
      <path data-part="edge" d={CARD_OUTLINE} />
      {picture && (
        <image
          href={picture.url}
          {...PORTRAIT_SCAN}
          preserveAspectRatio="none"
          clipPath={`url(#${clipId})`}
          onLoad={picture.onLoad}
          onError={picture.onError}
        />
      )}
      {enemy.health !== undefined && (
        <CountCircle
          kind="damage"
          value={damage}
          label={t('map.damage', { count: damage })}
          centre={ENEMY_FACE.damage}
        />
      )}
    </svg>
  );
}

/**
 * An enemy's attack as the printed card shows it on its type line: a heart per point of damage
 * left of the set medallion and a brain per point of horror right of it, the nearest one first,
 * each a little higher or lower than the one before, as printed.
 */
function Attack({ damage, horror }: { damage: number; horror: number }) {
  const { heartX, brainX, y, step, stagger } = ENEMY_FACE.attack;
  const at = (x: number, index: number) => ({ x, y: y - (index % 2) * stagger });
  return (
    <>
      {Array.from({ length: damage }, (_, index) => (
        <Heart
          key={`heart-${index}`}
          centre={at(heartX - index * step, index)}
          scale={ENEMY_FACE.heartScale}
        />
      ))}
      {Array.from({ length: horror }, (_, index) => (
        <Brain
          key={`brain-${index}`}
          centre={at(brainX + index * step, index)}
          scale={ENEMY_FACE.brainScale}
        />
      ))}
    </>
  );
}

/**
 * The skill a stat is tested against, on the frame beside its chevron as printed: the game's
 * symbol as HTML in a `foreignObject`, like the symbols in card text.
 */
function StatIcon({ symbol, centre: { x, y } }: { symbol: 'combat' | 'agility'; centre: Point }) {
  const size = ENEMY_FACE.statIcon;
  return (
    <foreignObject x={x - size / 2} y={y - size / 2} width={size} height={size}>
      <span data-symbol={symbol} data-part="stat-icon" />
    </foreignObject>
  );
}

/**
 * The keywords as the printed card lists them: the plain ones together on one line ("Hunter.
 * Retaliate."), each with a detail (prey, patrol, spawn) on its own line after them.
 */
function KeywordLines({ keywords }: { keywords: readonly Keyword[] }) {
  const { t } = useTranslation();
  const plain = keywords.filter((keyword) => keyword.detail === undefined);
  const detailed = keywords.filter((keyword) => keyword.detail !== undefined);
  return (
    <>
      {plain.length > 0 && (
        <p data-part="keywords">{sentences(plain.map(({ name }) => t(`keyword.${name}`)))}</p>
      )}
      {detailed.map(({ name, detail }, index) => (
        <p key={`${name}-${index}`} data-part="keywords">
          {t(`keyword.${name}`)} – {cardText(detail ?? '')}.
        </p>
      ))}
    </>
  );
}

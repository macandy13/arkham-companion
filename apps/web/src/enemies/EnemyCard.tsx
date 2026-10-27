import { useId, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { EnemyStatsView, Keyword, MapEnemyView } from '@arkham/engine';
import { sentences } from '@arkham/util';
import { ENEMY_ART, PORTRAIT_SCAN, portraitArtViewBox } from '../catalog/cardArt';
import { useCardPicture } from '../catalog/cardImages';
import { shrinkAround, useShrinkToFit } from '../map/useShrinkToFit';
import { ENEMY_CARD, ENEMY_FRAME, NAME_CENTRE, TYPE_CENTRE } from './enemyCardFrame';

/** The room the name has on the plate, between the swoops into its corners. */
const NAME_WIDTH = ENEMY_CARD.width - 26;

/** The hatch's cell, as on the location tiles' art while they have no picture. */
const HATCH = 20;

/** The symbols card text names in brackets (`[combat]`) that the card draws as icons. */
const SYMBOLS = [
  'willpower',
  'intellect',
  'combat',
  'agility',
  'wild',
  'per_investigator',
] as const;

/** A symbol card text can name that the card draws as an icon. */
type CardSymbol = (typeof SYMBOLS)[number];

function isCardSymbol(name: string): name is CardSymbol {
  return (SYMBOLS as readonly string[]).includes(name);
}

/**
 * An enemy drawn as its card, laid out like the printed enemy card in the style of the location
 * tiles (our own frame, no FFG template): the name on the plate, fight, health left (of its
 * health) and evade on shields under it, its traits, keywords and victory points in the text box
 * in our own words, its attack as damage and horror icons on the type line, and below that its
 * art, cut from the card's picture once that has loaded (a hatch until then, and for good
 * offline). The name's text has `titleId`, so the dialog showing the card is named by it. The
 * numbers, traits and keywords are HTML in `foreignObject`s, so they wrap and stay a list.
 */
export function EnemyCard({
  enemy,
  stats,
  titleId,
}: {
  enemy: MapEnemyView;
  stats: EnemyStatsView;
  titleId: string;
}) {
  const { t } = useTranslation();
  const clipId = useId();
  const paperId = useId();
  const hatchId = useId();
  const name = useRef<SVGTextElement>(null);
  const scale = useShrinkToFit(name, NAME_WIDTH, enemy.name);
  const picture = useCardPicture(stats.image);
  const { width, height, artTop, stats: shields, textBox, typeLine } = ENEMY_CARD;
  const art = { x: 0, y: artTop, width, height: height - artTop };
  const left = enemy.health === undefined ? undefined : enemy.health - (enemy.damage ?? 0);
  const statsTop = shields.y - shields.healthRadius;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      data-card="enemy"
      data-picture={picture?.shown ? 'shown' : undefined}
    >
      <defs>
        <clipPath id={clipId}>
          <path d={ENEMY_FRAME.card} />
        </clipPath>
        {/* The stylesheet colours the stops and the hatch, like the location tiles' fills. */}
        <linearGradient id={paperId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" />
          <stop offset="1" />
        </linearGradient>
        <pattern id={hatchId} width={HATCH} height={HATCH} patternUnits="userSpaceOnUse">
          <rect width={HATCH} height={HATCH} />
          <path d={`M 0 ${HATCH} L ${HATCH} 0`} />
        </pattern>
      </defs>
      <g clipPath={`url(#${clipId})`} aria-hidden="true">
        <path data-part="paper" d={ENEMY_FRAME.card} fill={`url(#${paperId})`} />
        <path data-part="box" d={ENEMY_FRAME.textBox} />
        <path data-part="watermark" d={ENEMY_FRAME.watermark} />
        <rect data-part="art" {...art} fill={`url(#${hatchId})`} />
        {picture && (
          <svg
            {...art}
            viewBox={portraitArtViewBox(ENEMY_ART)}
            preserveAspectRatio="xMidYMid slice"
          >
            <image
              href={picture.url}
              {...PORTRAIT_SCAN}
              preserveAspectRatio="none"
              onLoad={picture.onLoad}
              onError={picture.onError}
            />
          </svg>
        )}
        <path data-part="band" d={ENEMY_FRAME.band} />
        <path data-part="plate" d={ENEMY_FRAME.plate} fill={`url(#${paperId})`} />
        <path data-part="gilt" d={ENEMY_FRAME.topGilt} />
        <path data-part="band" d={ENEMY_FRAME.typeLine} />
        <path data-part="gilt" d={ENEMY_FRAME.typeGilt} />
      </g>
      <g aria-hidden="true">
        <path data-part="fight" d={ENEMY_FRAME.fight} />
        <path data-part="health" d={ENEMY_FRAME.health} />
        <path data-part="evade" d={ENEMY_FRAME.evade} />
        <path data-part="medallion" d={ENEMY_FRAME.medallion} />
        <path data-part="jewel" d={ENEMY_FRAME.jewel} />
        <path data-part="type" d={ENEMY_FRAME.typePlate} />
        <path data-part="edge" d={ENEMY_FRAME.card} />
      </g>
      <text id={titleId} ref={name} {...NAME_CENTRE} transform={shrinkAround(NAME_CENTRE, scale)}>
        {enemy.name}
      </text>
      <text {...TYPE_CENTRE} aria-hidden="true">
        {t('enemy.type')}
      </text>
      <foreignObject x={0} y={statsTop} width={width} height={2 * shields.healthRadius}>
        <dl>
          <div data-stat="fight">
            <dt>{t('enemy.fight')}</dt>
            <dd>{stats.fight}</dd>
          </div>
          <div data-stat="health">
            <dt>{t('enemy.health')}</dt>
            <dd>
              {left ?? '–'}{' '}
              {enemy.health !== undefined && <span>{t('enemy.ofMax', { max: enemy.health })}</span>}
            </dd>
          </div>
          <div data-stat="evade">
            <dt>{t('enemy.evade')}</dt>
            <dd>{stats.evade}</dd>
          </div>
        </dl>
      </foreignObject>
      <foreignObject {...textBox}>
        <div data-part="text">
          {stats.traits.length > 0 && <p data-part="traits">{sentences(stats.traits)}</p>}
          <KeywordLines keywords={stats.keywords} />
          {stats.victory !== undefined && (
            <p data-part="victory">{t('enemy.victory', { points: stats.victory })}</p>
          )}
        </div>
      </foreignObject>
      <foreignObject x={0} y={typeLine.end - 2} width={width} height={artTop - typeLine.end + 2}>
        <p
          data-part="attack"
          role="img"
          aria-label={`${t('enemy.attack')}: ${t('enemy.attackValue', stats.attack)}`}
        >
          <span aria-hidden="true">{points('damage', stats.attack.damage)}</span>
          <span aria-hidden="true">{points('horror', stats.attack.horror)}</span>
        </p>
      </foreignObject>
    </svg>
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
          {t(`keyword.${name}`)} – {withSymbols(detail ?? '')}.
        </p>
      ))}
    </>
  );
}

/** One icon per point of an attack, damage or horror. */
function points(kind: 'damage' | 'horror', count: number): ReactNode[] {
  return Array.from({ length: count }, (_, index) => <span key={index} data-symbol={kind} />);
}

/**
 * Card text with the symbols it names in brackets drawn as icons (`data-symbol`), each named by
 * its skill for assistive technology; brackets it has no icon for stay as text.
 */
function withSymbols(text: string): ReactNode[] {
  return text.split(/(\[[a-z_]+\])/).map((part, index) => {
    const symbol = /^\[([a-z_]+)\]$/.exec(part)?.[1];
    return symbol !== undefined && isCardSymbol(symbol) ? (
      <SymbolIcon key={index} symbol={symbol} />
    ) : (
      part
    );
  });
}

/** A game symbol in running text, named by its skill. */
function SymbolIcon({ symbol }: { symbol: CardSymbol }) {
  const { t } = useTranslation();
  return <span role="img" aria-label={t(`symbol.${symbol}`)} data-symbol={symbol} />;
}

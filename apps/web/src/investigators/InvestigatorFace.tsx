import { useId } from 'react';
import { SKILL_NAMES, type SkillName } from '@arkham/engine';
import type { InvestigatorClass } from '@arkham/carddata';
import { LANDSCAPE_SCAN } from '../catalog/cardArt';
import { NightSky } from '../catalog/cardFace';
import type { CardPicture } from '../catalog/cardImages';
import './investigator_face.css';

/**
 * Where an investigator card prints its parts, in landscape scan units (`LANDSCAPE_SCAN`),
 * measured on the ArkhamDB scan of Roland Banks and checked by laying the drawing over it (the
 * exact card templates, MD.10): the class shield in the top left corner, the name plate with its
 * pointed right end and the subname plate under it, the skill chain across the top right with
 * one plate per skill with its value and icon, and the spiral-bound notebook page under it. The
 * play screen shows only the card's top (`card.height`): the players hold the card, so its
 * abilities and flavour make way for the board, and the page is a strip for the counters. The
 * scan's art is lifted by `art.lift`, so the portrait's face shows under the plates, and the frame
 * covers what the lifted scan prints round it: a header behind the plates and a column round the
 * page. The panel's HTML (InvestigatorBar) lies over these places, which tokens.css gives
 * again for the stylesheet (`--investigator-*`, in the same scan units): change both together.
 */
export const INVESTIGATOR_FACE = {
  card: { height: 130 },
  /** The scan's art, lifted so the portrait's face shows; the frame's header and column cover the rest. */
  art: { lift: 20, header: 46, column: 222 },
  /** The shield's flat top, where its sides start to curve, its point, and how far the curve bulges. */
  shield: { left: 7, right: 35, top: 4, shoulder: 20, point: 35, bulge: 9, iconInset: 4 },
  name: { left: 36, right: 212, tip: 222, top: 6, bottom: 32 },
  subname: { left: 48, right: 204, slant: 6, top: 31, bottom: 46 },
  chain: { left: 219, top: 4, width: 200, height: 42 },
  link: { left: 226, step: 48.5, top: 7, width: 44, height: 36, corner: 14 },
  ring: { offset: 46.5, y: 25, outer: 9, inner: 5 },
  plate: { left: 228, top: 9, width: 40, height: 32, corner: 12 },
  /** A skill's icon, its centre from its plate's left edge, in one colour beside the value. */
  glyph: { x: 30, y: 25, size: 15 },
  page: { left: 230, top: 52, width: 184, height: 72, shadow: 3 },
  rules: { left: 236, right: 410, first: 86, step: 14.5, last: 120 },
  /** The binding: a loop every `step` along the page's top, `rise` high, its end `reach` along and `drop` down. */
  spiral: { first: 238, last: 412, step: 8.7, y: 62, rise: 12, reach: 4, drop: 6, eye: 1.6 },
} as const;

/**
 * The phone's slim strip (MD.10g option B), in the same scan units, 419 wide like the banner: the
 * scan's art as a round portrait on the left with the class shield on its lower right, the name
 * and subname plates and the skill chain of the banner (`INVESTIGATOR_FACE`) scaled down side by
 * side along the top, and under them a paper strip for the counters. Each scaled group is the
 * banner's drawing moved to (`x`, `y`) and shrunk by `scale`, so both shapes share one drawing.
 * tokens.css gives the places again for the strip (`[data-shape='strip']`): change both together.
 */
export const INVESTIGATOR_STRIP = {
  card: { height: 88 },
  /** The disc's centre and radius, and the scan's point it centres on at the scan's `scale`. */
  portrait: { x: 42, y: 44, radius: 36, scale: 0.5, focusX: 113, focusY: 112 },
  shield: { x: 56, y: 48, scale: 0.75 },
  plates: { x: 57.2, y: -0.8, scale: 0.8 },
  chain: { x: 58.85, y: 0.6, scale: 0.85 },
  paper: { left: 88, top: 46, width: 326, height: 38 },
} as const;

/** The two shapes of the card on the play screen: the tablet's banner and the phone's strip. */
export type InvestigatorFaceShape = 'banner' | 'strip';

const { width, height } = LANDSCAPE_SCAN;
const cardHeight = INVESTIGATOR_FACE.card.height;

/** The face's parts as SVG paths in scan units, each named for the stylesheet. */
function facePaths() {
  const { shield, name, subname, page, rules, spiral, link, ring, art } = INVESTIGATOR_FACE;
  const { paper } = INVESTIGATOR_STRIP;
  const middle = (name.top + name.bottom) / 2;
  const half = (shield.left + shield.right) / 2;
  const ruleCount = Math.floor((rules.last - rules.first) / rules.step) + 1;
  const spiralCount = Math.floor((spiral.last - spiral.first) / spiral.step) + 1;
  const pageEdge = `h ${page.width} v ${page.height} h ${-page.width} Z`;
  return {
    frame: `M 0 0 H ${width} V ${cardHeight} H ${art.column} V ${art.header} H 0 Z`,
    paper: `M ${paper.left} ${paper.top} h ${paper.width} v ${paper.height} h ${-paper.width} Z`,
    shield: `M ${shield.left} ${shield.top} H ${shield.right} V ${shield.shoulder} C ${shield.right} ${shield.shoulder + shield.bulge} ${half} ${shield.point} ${half} ${shield.point} C ${half} ${shield.point} ${shield.left} ${shield.shoulder + shield.bulge} ${shield.left} ${shield.shoulder} Z`,
    name: `M ${name.left} ${name.top} H ${name.right} L ${name.tip} ${middle} L ${name.right} ${name.bottom} H ${name.left} Z`,
    subname: `M ${subname.left} ${subname.top} H ${subname.right} L ${subname.right - subname.slant} ${subname.bottom} H ${subname.left + subname.slant} Z`,
    links: SKILL_NAMES.map((_, index) => link.left + index * link.step),
    rings: SKILL_NAMES.slice(1).map((_, index) => link.left + index * link.step + ring.offset),
    pageShadow: `M ${page.left + page.shadow} ${page.top + page.shadow} ${pageEdge}`,
    page: `M ${page.left} ${page.top} ${pageEdge}`,
    rules: Array.from(
      { length: ruleCount },
      (_, index) => `M ${rules.left} ${rules.first + index * rules.step} H ${rules.right}`,
    ).join(' '),
    spiral: Array.from({ length: spiralCount }, (_, index) => {
      const x = spiral.first + index * spiral.step;
      const top = spiral.y - spiral.rise;
      const end = x + spiral.reach;
      return `M ${x.toFixed(1)} ${spiral.y} C ${x.toFixed(1)} ${top} ${end.toFixed(1)} ${top} ${end.toFixed(1)} ${spiral.y - spiral.drop}`;
    }).join(' '),
    spiralEyes: Array.from(
      { length: spiralCount },
      (_, index) => spiral.first + index * spiral.step,
    ),
  };
}

/** The face's paths, the same for every card (`facePaths`). */
const PATHS = facePaths();

/**
 * The top of an investigator card's face in the card theme's colours (`--color-face-*`), in
 * landscape scan units: our own drawing of the printed layout (`INVESTIGATOR_FACE`, no FFG art) over the
 * card's `picture` once it has loaded (a hatch until then, and for good offline), so the printed
 * frame and text of the scan fall under the face's own. The tablet's `banner` shows the card's
 * top; the phone's `strip` packs the same parts into a slimmer row (`INVESTIGATOR_STRIP`). The
 * shield takes the colour and icon of the investigator's `investigatorClass`; each skill's plate
 * its icon in the face's ink. The panel lays the name, the skills' values and the counters over
 * it in HTML (InvestigatorBar), so this is decoration only (`aria-hidden`).
 */
export function InvestigatorFace({
  picture,
  investigatorClass,
  shape = 'banner',
}: {
  picture: CardPicture | undefined;
  investigatorClass: InvestigatorClass | undefined;
  shape?: InvestigatorFaceShape;
}) {
  const pageId = useId();
  if (shape === 'strip') {
    return <StripFace picture={picture} investigatorClass={investigatorClass} />;
  }
  const { spiral, art } = INVESTIGATOR_FACE;
  return (
    <svg
      viewBox={`0 0 ${width} ${cardHeight}`}
      aria-hidden="true"
      data-face="investigator"
      data-shape="banner"
    >
      <PageGradient id={pageId} />
      <rect data-part="art" width={width} height={cardHeight} />
      {picture && (
        <image
          href={picture.url}
          y={-art.lift}
          width={width}
          height={height}
          preserveAspectRatio="none"
          onLoad={picture.onLoad}
          onError={picture.onError}
        />
      )}
      <path data-part="frame" d={PATHS.frame} />
      <Shield investigatorClass={investigatorClass} />
      <Plates />
      <Chain />
      <path data-part="page-shadow" d={PATHS.pageShadow} />
      <path data-part="page" d={PATHS.page} fill={`url(#${pageId})`} />
      <NightSky page={PATHS.page} scan={{ width, height: cardHeight }} />
      <path data-part="rules" d={PATHS.rules} />
      <path data-part="spiral" d={PATHS.spiral} />
      {PATHS.spiralEyes.map((x) => (
        <circle key={x} data-part="spiral-eye" cx={x} cy={spiral.y} r={spiral.eye} />
      ))}
    </svg>
  );
}

/**
 * The phone's strip (`INVESTIGATOR_STRIP`): the frame, the scan's art cut to a disc, the
 * banner's shield, plates and chain scaled into place, and the paper strip for the counters.
 */
function StripFace({
  picture,
  investigatorClass,
}: {
  picture: CardPicture | undefined;
  investigatorClass: InvestigatorClass | undefined;
}) {
  const pageId = useId();
  const discId = useId();
  const { card, portrait, shield, plates, chain } = INVESTIGATOR_STRIP;
  const placed = ({ x, y, scale }: { x: number; y: number; scale: number }) =>
    `translate(${x} ${y}) scale(${scale})`;
  return (
    <svg
      viewBox={`0 0 ${width} ${card.height}`}
      aria-hidden="true"
      data-face="investigator"
      data-shape="strip"
    >
      <PageGradient id={pageId} />
      <clipPath id={discId}>
        <circle cx={portrait.x} cy={portrait.y} r={portrait.radius} />
      </clipPath>
      <rect data-part="frame" width={width} height={card.height} />
      <circle data-part="art" cx={portrait.x} cy={portrait.y} r={portrait.radius} />
      {picture && (
        <image
          href={picture.url}
          clipPath={`url(#${discId})`}
          x={portrait.x - portrait.focusX * portrait.scale}
          y={portrait.y - portrait.focusY * portrait.scale}
          width={width * portrait.scale}
          height={height * portrait.scale}
          preserveAspectRatio="none"
          onLoad={picture.onLoad}
          onError={picture.onError}
        />
      )}
      <circle data-part="rim" cx={portrait.x} cy={portrait.y} r={portrait.radius} />
      <g transform={placed(shield)}>
        <Shield investigatorClass={investigatorClass} />
      </g>
      <g transform={placed(plates)}>
        <Plates />
      </g>
      <g transform={placed(chain)}>
        <Chain />
      </g>
      <path data-part="page" d={PATHS.paper} fill={`url(#${pageId})`} />
      <NightSky page={PATHS.paper} scan={{ width, height: card.height }} />
    </svg>
  );
}

/** The page's paper, shaded downwards; the stylesheet colours the stops, like the other faces' paper. */
function PageGradient({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" />
        <stop offset="1" />
      </linearGradient>
    </defs>
  );
}

/** The class shield in the card's top left corner, in the class's colour with its icon. */
function Shield({ investigatorClass }: { investigatorClass: InvestigatorClass | undefined }) {
  const { shield } = INVESTIGATOR_FACE;
  return (
    <>
      <path data-part="shield" data-class={investigatorClass} d={PATHS.shield} />
      {investigatorClass && (
        <foreignObject
          x={shield.left + shield.iconInset}
          y={shield.top + shield.iconInset / 2}
          width={shield.right - shield.left - 2 * shield.iconInset}
          height={shield.right - shield.left - 2 * shield.iconInset}
        >
          <span data-class-icon={investigatorClass} />
        </foreignObject>
      )}
    </>
  );
}

/** The name plate with its pointed end and the subname plate under it. */
function Plates() {
  return (
    <>
      <path data-part="plate" d={PATHS.name} />
      <path data-part="plate" d={PATHS.subname} />
    </>
  );
}

/** The skill chain: its band, a link per skill joined by rings, and each skill's plate. */
function Chain() {
  const { chain, link, ring, plate } = INVESTIGATOR_FACE;
  return (
    <>
      <rect
        data-part="chain-band"
        x={chain.left}
        y={chain.top}
        width={chain.width}
        height={chain.height}
        rx={chain.height / 2}
      />
      {PATHS.links.map((x) => (
        <rect
          key={x}
          data-part="link"
          x={x}
          y={link.top}
          width={link.width}
          height={link.height}
          rx={link.corner}
        />
      ))}
      {PATHS.rings.map((x) => (
        <g key={x} data-part="ring">
          <circle cx={x} cy={ring.y} r={ring.outer} />
          <circle cx={x} cy={ring.y} r={ring.inner} />
        </g>
      ))}
      {SKILL_NAMES.map((skill, index) => (
        <SkillPlate key={skill} skill={skill} left={plate.left + index * link.step} />
      ))}
    </>
  );
}

/**
 * One skill's place on the chain: its plate, where the panel writes the value, and the skill's
 * icon beside it in one colour, the face's ink (`data-skill`, the icon the stylesheet gives it).
 */
function SkillPlate({ skill, left }: { skill: SkillName; left: number }) {
  const { plate, glyph } = INVESTIGATOR_FACE;
  return (
    <g data-skill={skill}>
      <rect
        data-part="skill-plate"
        x={left}
        y={plate.top}
        width={plate.width}
        height={plate.height}
        rx={plate.corner}
      />
      <foreignObject
        x={left + glyph.x - glyph.size / 2}
        y={glyph.y - glyph.size / 2}
        width={glyph.size}
        height={glyph.size}
      >
        <span data-skill-icon="" />
      </foreignObject>
    </g>
  );
}

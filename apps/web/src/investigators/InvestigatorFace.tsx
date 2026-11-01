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
 * one plate and one diamond per skill, and the spiral-bound notebook page under it. The art fills
 * the rest. The panel's HTML (InvestigatorBar) lies over these places, which tokens.css gives
 * again for the stylesheet (`--investigator-*`, in the same scan units): change both together.
 */
export const INVESTIGATOR_FACE = {
  /** The shield's flat top, where its sides start to curve, its point, and how far the curve bulges. */
  shield: { left: 7, right: 35, top: 4, shoulder: 20, point: 35, bulge: 9, iconInset: 4 },
  name: { left: 36, right: 212, tip: 222, top: 6, bottom: 32 },
  subname: { left: 48, right: 204, slant: 6, top: 31, bottom: 46 },
  chain: { left: 219, top: 4, width: 200, height: 42 },
  link: { left: 226, step: 48.5, top: 7, width: 44, height: 36, corner: 14 },
  ring: { offset: 46.5, y: 25, outer: 9, inner: 5 },
  plate: { left: 228, top: 9, width: 40, height: 32, corner: 12 },
  /** A skill's diamond, from its plate's left edge, and its icon's size in the diamond's half width. */
  diamond: { x: 29, y: 25, half: 9, icon: 1.25 },
  page: { left: 230, top: 52, width: 184, height: 232, shadow: 3 },
  rules: { left: 236, right: 410, first: 86, step: 14.5, last: 282 },
  /** The binding: a loop every `step` along the page's top, `rise` high, its end `reach` along and `drop` down. */
  spiral: { first: 238, last: 412, step: 8.7, y: 62, rise: 12, reach: 4, drop: 6, eye: 1.6 },
} as const;

const { width, height } = LANDSCAPE_SCAN;

/** The face's parts as SVG paths in scan units, each named for the stylesheet. */
function facePaths() {
  const { shield, name, subname, page, rules, spiral, link, ring } = INVESTIGATOR_FACE;
  const middle = (name.top + name.bottom) / 2;
  const half = (shield.left + shield.right) / 2;
  const ruleCount = Math.floor((rules.last - rules.first) / rules.step) + 1;
  const spiralCount = Math.floor((spiral.last - spiral.first) / spiral.step) + 1;
  const pageEdge = `h ${page.width} v ${page.height} h ${-page.width} Z`;
  return {
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

/**
 * The face of an investigator card in the card theme's colours (`--color-face-*`), in landscape
 * scan units: our own drawing of the printed layout (`INVESTIGATOR_FACE`, no FFG art) over the
 * card's `picture` once it has loaded (a hatch until then, and for good offline), so the printed
 * frame and text of the scan fall under the face's own. The shield takes the colour and icon of
 * the investigator's `investigatorClass`; each skill's diamond its colour and icon. The panel lays
 * the name, the skills' values, the page's text and the counters over it in HTML
 * (InvestigatorBar), so this is decoration only (`aria-hidden`).
 */
export function InvestigatorFace({
  picture,
  investigatorClass,
}: {
  picture: CardPicture | undefined;
  investigatorClass: InvestigatorClass | undefined;
}) {
  const pageId = useId();
  const paths = facePaths();
  const { shield, chain, link, ring, plate, spiral } = INVESTIGATOR_FACE;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true" data-face="investigator">
      <defs>
        {/* The stylesheet colours the stops, like the other faces' paper. */}
        <linearGradient id={pageId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" />
          <stop offset="1" />
        </linearGradient>
      </defs>
      <rect data-part="art" width={width} height={height} />
      {picture && (
        <image
          href={picture.url}
          width={width}
          height={height}
          preserveAspectRatio="none"
          onLoad={picture.onLoad}
          onError={picture.onError}
        />
      )}
      <path data-part="shield" data-class={investigatorClass} d={paths.shield} />
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
      <path data-part="plate" d={paths.name} />
      <path data-part="plate" d={paths.subname} />
      <rect
        data-part="chain-band"
        x={chain.left}
        y={chain.top}
        width={chain.width}
        height={chain.height}
        rx={chain.height / 2}
      />
      {paths.links.map((x) => (
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
      {paths.rings.map((x) => (
        <g key={x} data-part="ring">
          <circle cx={x} cy={ring.y} r={ring.outer} />
          <circle cx={x} cy={ring.y} r={ring.inner} />
        </g>
      ))}
      {SKILL_NAMES.map((skill, index) => (
        <SkillPlate key={skill} skill={skill} left={plate.left + index * link.step} />
      ))}
      <path data-part="page-shadow" d={paths.pageShadow} />
      <path data-part="page" d={paths.page} fill={`url(#${pageId})`} />
      <NightSky page={paths.page} scan={LANDSCAPE_SCAN} />
      <path data-part="rules" d={paths.rules} />
      <path data-part="spiral" d={paths.spiral} />
      {paths.spiralEyes.map((x) => (
        <circle key={x} data-part="spiral-eye" cx={x} cy={spiral.y} r={spiral.eye} />
      ))}
    </svg>
  );
}

/**
 * One skill's place on the chain, its plate (where the panel writes the value) and the diamond in
 * the skill's colour with its icon (`data-skill`, the colour and icon the stylesheet gives it).
 */
function SkillPlate({ skill, left }: { skill: SkillName; left: number }) {
  const { plate, diamond } = INVESTIGATOR_FACE;
  const x = left + diamond.x;
  const y = diamond.y;
  const { half } = diamond;
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
      <path
        data-part="diamond"
        d={`M ${x} ${y - half - 1} L ${x + half} ${y} L ${x} ${y + half + 1} L ${x - half} ${y} Z`}
      />
      <foreignObject
        x={x - (half * diamond.icon) / 2}
        y={y - (half * diamond.icon) / 2}
        width={half * diamond.icon}
        height={half * diamond.icon}
      >
        <span data-skill-icon="" />
      </foreignObject>
    </g>
  );
}

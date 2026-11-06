import { z } from 'zod';

/**
 * Reads the campaign guide data of ArkhamCards (`zzorba/arkham-cards-data`): the setup steps of a
 * scenario as the guide prints them, which ArkhamDB's card data lacks. The data has no licence,
 * so it is only read at build time from the gitignored cache (`campaign_guides_fetch.ts`) and
 * never committed; a scenario author copies the facts it gives (codes, cells) into the
 * hand-entered `ScenarioDefinition` (M4.1, product.md "Scenario data pipeline").
 */

/** Which side of a card a layout cell shows: ArkhamCards writes `<code>_back` for the back. */
export type CardSide = 'front' | 'back';

/**
 * A position in a layout, counted in card steps from the top left (column to the right, row
 * downwards): a card one step to the right of another lies one card width further. A guide with
 * half spacing puts cards half a step apart, so positions can be fractions. The engine's
 * `GridCell` is this times `GRID_CELLS_PER_CARD`.
 */
export interface LayoutPosition {
  column: number;
  row: number;
}

/**
 * One filled cell of a guide's location layout: a card by code, or a named slot (`key`) where
 * the guide shows no single card, such as one of several copies picked at random or a location
 * that is not in play yet. `name` is the guide's label for a named slot, absent when the guide
 * gives none; such a slot is still to be filled in by hand.
 */
export type LayoutSlot =
  | {
      readonly kind: 'card';
      readonly code: string;
      readonly side: CardSide;
      readonly at: LayoutPosition;
    }
  | {
      readonly kind: 'named';
      readonly key: string;
      readonly name?: string;
      readonly at: LayoutPosition;
    };

/**
 * One location layout of a scenario (an ArkhamCards `location_setup` step): the slots of the
 * book's "Location Placement" diagram, plus what the import leaves out so the report can list it.
 */
export interface LocationLayout {
  /** The step's id in the guide, e.g. `location_layout_dawn` for one of two layouts. */
  readonly id: string;
  /** The guide's heading, e.g. "Location Placement (Act 2)". */
  readonly title: string;
  readonly slots: readonly LayoutSlot[];
  /** The guide's note under the diagram (HTML as the guide writes it), when it has one. */
  readonly note?: string;
  /** Diagram parts the import does not read (`arrows`, `annotations`, …), with their count. */
  readonly skipped: Readonly<Record<string, number>>;
  /** Spacings the import does not know and read as a full step, e.g. `horizontal: tight`. */
  readonly unknownSpacing: readonly string[];
}

/** A scenario's layouts as the guide gives them, in step order (`scenarioLayouts`). */
export interface ScenarioLayouts {
  /** ArkhamCards' scenario id, e.g. `arkham` for The Midnight Masks; `core` for campaign-wide steps. */
  readonly id: string;
  /** The scenario's name, or its id for a file without one (`core`). */
  readonly name: string;
  readonly layouts: readonly LocationLayout[];
}

/** How far apart the guide's grid cells are, in card steps (see `LayoutPosition`). */
const SPACING_STEPS: Readonly<Record<string, number>> = { normal: 1, half: 0.5 };

/** Diagram parts of a `location_setup` step that the import does not read. */
const SKIPPED_PARTS = [
  'arrows',
  'annotations',
  'cards',
  'decorations',
  'resource_dividers',
] as const;

/** A card code cell: five digits and an optional letter, then the side and a rotation. */
const CARD_CELL = /^(\d{5}[a-z]?)(_back[a-z]?)?(_rotate(_left)?)?$/;

const opt = <T extends z.ZodTypeAny>(s: T) => s.nullish().transform((v) => v ?? undefined);

/** Raw `location_setup` step (only the fields read), checked because the data is external. */
const RawLocationSetupSchema = z.object({
  id: z.string(),
  type: z.literal('location_setup'),
  text: z.string(),
  horizontal: z.string(),
  vertical: z.string(),
  locations: z.array(z.array(z.string())),
  location_names: opt(z.array(z.object({ code: z.string(), name: z.string() }))),
  note: opt(z.string()),
  arrows: opt(z.array(z.unknown())),
  annotations: opt(z.array(z.unknown())),
  cards: opt(z.array(z.unknown())),
  decorations: opt(z.array(z.unknown())),
  resource_dividers: opt(z.array(z.unknown())),
});

/**
 * Raw ArkhamCards scenario file: its steps stay unknown until a step's type is read. A
 * campaign's `core.json` holds its campaign-wide steps in the same shape, without a name.
 */
const RawScenarioSchema = z.object({
  id: z.string(),
  scenario_name: opt(z.string()),
  steps: z.array(z.object({ type: opt(z.string()) }).loose()),
});

/**
 * The location layouts of one ArkhamCards scenario file (`campaigns/<campaign>/<scenario>.json`),
 * in step order. Throws when the file or one of its `location_setup` steps no longer has the
 * shape read here, so a change upstream shows up instead of an empty layout.
 */
export function scenarioLayouts(rawScenario: unknown): ScenarioLayouts {
  const scenario = RawScenarioSchema.parse(rawScenario);
  return {
    id: scenario.id,
    name: scenario.scenario_name ?? scenario.id,
    layouts: scenario.steps
      .filter((step) => step.type === 'location_setup')
      .map((step) => locationLayout(RawLocationSetupSchema.parse(step))),
  };
}

function locationLayout(step: z.infer<typeof RawLocationSetupSchema>): LocationLayout {
  const names = new Map((step.location_names ?? []).map(({ code, name }) => [code, name]));
  const columnStep = SPACING_STEPS[step.horizontal] ?? 1;
  const rowStep = SPACING_STEPS[step.vertical] ?? 1;
  const slots = step.locations.flatMap((cells, row) =>
    cells.flatMap((cell, column) => {
      const at = { column: column * columnStep, row: row * rowStep };
      return cell === 'blank' ? [] : [layoutSlot(cell, at, names)];
    }),
  );
  return {
    id: step.id,
    title: step.text,
    slots,
    ...(step.note === undefined ? {} : { note: step.note }),
    skipped: skippedParts(step),
    unknownSpacing: [
      ...(step.horizontal in SPACING_STEPS ? [] : [`horizontal: ${step.horizontal}`]),
      ...(step.vertical in SPACING_STEPS ? [] : [`vertical: ${step.vertical}`]),
    ],
  };
}

function layoutSlot(
  cell: string,
  at: LayoutPosition,
  names: ReadonlyMap<string, string>,
): LayoutSlot {
  const card = CARD_CELL.exec(cell);
  if (card?.[1]) return { kind: 'card', code: card[1], side: card[2] ? 'back' : 'front', at };
  const name = names.get(cell);
  return { kind: 'named', key: cell, ...(name === undefined ? {} : { name }), at };
}

function skippedParts(step: z.infer<typeof RawLocationSetupSchema>): Record<string, number> {
  return Object.fromEntries(
    SKIPPED_PARTS.flatMap((part) => {
      const count = step[part]?.length ?? 0;
      return count > 0 ? [[part, count]] : [];
    }),
  );
}

/**
 * The import report of a campaign's scenarios, one line per finding, for a scenario author to
 * check what still has to be entered by hand: each layout's slots, the named slots without a
 * guide label, the diagram parts left out and the spacings read as a full step.
 */
export function layoutReport(scenarios: readonly ScenarioLayouts[]): string[] {
  return scenarios.flatMap((scenario) => [
    `${scenario.name} (${scenario.id})`,
    ...(scenario.layouts.length === 0
      ? ['  no location layout: place the locations by hand']
      : scenario.layouts.flatMap(layoutLines)),
  ]);
}

function layoutLines(layout: LocationLayout): string[] {
  const unnamed = layout.slots.flatMap((slot) =>
    slot.kind === 'named' && slot.name === undefined ? [slot.key] : [],
  );
  const skipped = Object.entries(layout.skipped).map(([part, count]) => `${part} ×${count}`);
  return [
    `  ${layout.title} (${layout.id}): ${layout.slots.map(slotLabel).join(', ')}`,
    ...(unnamed.length ? [`    unnamed slots: ${unnamed.join(', ')}`] : []),
    ...(skipped.length ? [`    not imported: ${skipped.join(', ')}`] : []),
    ...layout.unknownSpacing.map((spacing) => `    unknown spacing, read as one step: ${spacing}`),
  ];
}

function slotLabel(slot: LayoutSlot): string {
  const at = `${slot.at.column},${slot.at.row}`;
  if (slot.kind === 'named') return `${slot.name ?? slot.key} @${at}`;
  return `${slot.code}${slot.side === 'back' ? ' (back)' : ''} @${at}`;
}

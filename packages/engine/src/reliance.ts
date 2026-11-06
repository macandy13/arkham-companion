import type { NoticeKind } from './change_notices';

/**
 * How much the players rely on the app's helpers, chosen per campaign or standalone game (M1C.2d):
 * `display` shows them every change the app makes, `assist` the ones that matter at the table,
 * `auto` only what they must do themselves. For now it only filters the change notices; card
 * automation (M7) is to read the same level, so it is the engine's concept, not the screen's.
 */
export type Reliance = 'display' | 'assist' | 'auto';

/** Every `Reliance`, from the least to the most the players leave to the app, for a picker. */
export const RELIANCES: readonly Reliance[] = ['display', 'assist', 'auto'];

/** The level of a game or campaign that never chose one: every change shows, as before M1C.2d. */
export const DEFAULT_RELIANCE: Reliance = 'display';

/**
 * The notice kinds each level shows. `assist` drops the token counts and card moves, which the
 * board already shows as they change, and keeps changes to the chaos bag (which the board does
 * not show), what happens to the investigators and the enemies, the cards drawn and what the players must do by hand; `auto` keeps only the latter.
 */
const SHOWN: Readonly<Record<Reliance, ReadonlySet<NoticeKind>>> = {
  display: new Set(['tokens', 'chaosBag', 'board', 'investigator', 'enemy', 'encounter', 'byHand']),
  assist: new Set(['chaosBag', 'investigator', 'enemy', 'encounter', 'byHand']),
  auto: new Set(['byHand']),
};

/** Whether players relying on the helpers as much as `reliance` are shown a notice of `kind`. */
export function showsNotice(reliance: Reliance, kind: NoticeKind): boolean {
  return SHOWN[reliance].has(kind);
}

import { candidatesOf } from './abilities/resolve';
import { cardStats, comparableName, type CardStats, type EngineContext } from './cards';
import { activeInvestigators } from './investigators';
import type { PreyInstruction } from './prey_instruction';
import type { CardInstance, GameState, Investigator } from './state';

/**
 * The investigators among `candidates` that the prey keyword of `enemy` picks (Rules Reference,
 * "Prey"): the active ones it prefers, or all of them when it prefers none. With "only" it picks
 * among every active investigator and keeps the candidates it picked, possibly none: the enemy
 * ignores everyone else. Without a prey keyword, or with a text the engine can't read from the
 * board (Yithian Observer's "Fewest cards in hand", as the engine doesn't track hands), every
 * active candidate stays and the players decide, asked with `preyPrompt`.
 */
export function preferredByPrey(
  ctx: EngineContext,
  state: GameState,
  enemy: CardInstance,
  candidates: readonly Investigator[],
): Investigator[] {
  const active = candidates.filter((inv) => inv.status === 'active');
  const prey = readPrey(ctx, state, enemy);
  if (prey === undefined || active.length === 0) return active;
  const within = prey.only
    ? activeInvestigators(state).filter((inv) => inv.locationId !== undefined)
    : active;
  const picked = new Set(
    candidatesOf(
      ctx,
      state,
      prey.select,
      enemy.id,
      undefined,
      within.map((inv) => inv.id),
    ),
  );
  const preferred = active.filter((inv) => picked.has(inv.id));
  return preferred.length > 0 || prey.only ? preferred : active;
}

/**
 * The investigators among `investigators` that `enemy` may move towards or engage on its own:
 * with "Prey – … only" those its prey picks, otherwise all of them (Rules Reference, "Prey").
 */
export function preyAllows(
  ctx: EngineContext,
  state: GameState,
  enemy: CardInstance,
  investigators: readonly Investigator[],
): Investigator[] {
  return readPrey(ctx, state, enemy)?.only === true
    ? preferredByPrey(ctx, state, enemy, investigators)
    : [...investigators];
}

/**
 * The prompt for a choice between the investigators `preferredByPrey` left for `enemy`: `prompt`
 * when the prey was read and only a tie is left, `decision.choosePrey` when the players have to
 * judge the prey themselves.
 */
export function preyPrompt(
  ctx: EngineContext,
  state: GameState,
  enemy: CardInstance,
  prompt: string,
): string {
  const stats = cardStats(ctx.cards, enemy.code);
  return preyText(stats) !== undefined && readPrey(ctx, state, enemy) === undefined
    ? 'decision.choosePrey'
    : prompt;
}

function preyText(stats: CardStats): string | undefined {
  return stats.keywords?.find((keyword) => keyword.name === 'prey')?.detail;
}

/**
 * The prey of `enemy` (`CardStats.preyOn`), or undefined for one the engine can't read from the
 * board: an investigator's name nobody in this game has (Yithian Observer's "Fewest cards in
 * hand" reads as one), or "Bearer" on a card nobody owns.
 */
function readPrey(
  ctx: EngineContext,
  state: GameState,
  enemy: CardInstance,
): PreyInstruction | undefined {
  const prey = cardStats(ctx.cards, enemy.code).preyOn;
  if (prey === undefined) return undefined;
  const { name, bearerOf } = prey.select.among;
  if (
    name !== undefined &&
    !state.investigators.some((inv) => comparableName(inv.name) === comparableName(name))
  )
    return undefined;
  if (bearerOf !== undefined && enemy.owner === undefined) return undefined;
  return prey;
}

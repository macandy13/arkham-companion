import type { AddLastingEffect, EndLastingEffect } from './commands';
import type { LastingEffectAdded, LastingEffectEnded } from './events';
import { CommandRejected } from './rejection';
import type { GameState, SkillModifier } from './state';

/** `AddLastingEffect`: puts the effect into play, unless its id is taken or its amount is invalid. */
export function handleAddLastingEffect(
  state: GameState,
  { effect }: AddLastingEffect,
): LastingEffectAdded[] {
  if (state.lastingEffects.some((existing) => existing.id === effect.id))
    throw new CommandRejected({ code: 'duplicateLastingEffect', effectId: effect.id });
  assertModifierAmount(effect.modifier);
  return [{ type: 'LastingEffectAdded', effect }];
}

/** `EndLastingEffect`: ends an effect that is in effect. */
export function handleEndLastingEffect(
  state: GameState,
  { effectId }: EndLastingEffect,
): LastingEffectEnded[] {
  if (!state.lastingEffects.some((effect) => effect.id === effectId))
    throw new CommandRejected({ code: 'unknownLastingEffect', effectId });
  return [{ type: 'LastingEffectEnded', effectId }];
}

/**
 * The effects that expire as the round ends (upkeep step 4.6): every
 * "until the end of the round" effect.
 */
export function roundEndExpiry(state: GameState): LastingEffectEnded[] {
  return state.lastingEffects
    .filter((effect) => effect.until === 'endOfRound')
    .map((effect) => ({ type: 'LastingEffectEnded', effectId: effect.id }));
}

/**
 * Rejects a modifier that changes nothing or by a fraction: a zero would
 * only clutter the explanation trace, and printed modifiers are whole numbers.
 */
function assertModifierAmount({ amount }: SkillModifier): void {
  if (!Number.isInteger(amount) || amount === 0)
    throw new CommandRejected({ code: 'invalidModifierAmount', amount });
}

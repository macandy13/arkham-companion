/**
 * Splits an ordered log into the part that stays and the last command group
 * that `Undo` removes. A group is the maximal run of trailing entries sharing
 * one `commandId` – one player command with its whole trigger chain and
 * decision consequences (see `handle`), so undo never leaves half a command.
 * Generic over the entry type so it works for `StoredEvent`s and test logs alike.
 */
export function undoLastGroup<T extends { commandId: string }>(
  log: readonly T[],
): { kept: T[]; removed: T[] } {
  const last = log.at(-1);
  if (!last) return { kept: [], removed: [] };
  let cut = log.length - 1;
  while (cut > 0 && log[cut - 1]!.commandId === last.commandId) cut--;
  return { kept: log.slice(0, cut), removed: log.slice(cut) };
}

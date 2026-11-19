import type { CodeRef } from './tour.ts';

/** One file of a unified diff, by {@link parseDiff}. */
export interface FileDiff {
  /** The PR adds the file, so every line is new and none is worth marking as added. */
  readonly newFile: boolean;
  readonly added: number;
  readonly removed: number;
  /** Every line the diff shows, in order; with full context (`-U1000000`) the whole head file. */
  readonly lines: readonly DiffLine[];
}

/** A line of a hunk: context and added lines carry their head line number, removed lines their base one. */
export type DiffLine =
  | { readonly kind: 'context' | 'added'; readonly head: number; readonly text: string }
  | { readonly kind: 'removed'; readonly base: number; readonly text: string };

/** A line the page shows at a stop, by {@link cutStopLines}; a gap stands for skipped lines. */
export type TourLine =
  | {
      readonly kind: 'context' | 'added';
      readonly number: number;
      readonly text: string;
      readonly highlighted: boolean;
    }
  | {
      readonly kind: 'removed';
      readonly number: number;
      readonly text: string;
      readonly highlighted: false;
    }
  | { readonly kind: 'gap'; readonly text: string };

const NEW_SIDE = /^\+\+\+ (?:b\/(.+)|\/dev\/null)$/;
const HUNK = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

/**
 * Parses `git diff` output into its files by head path; a deleted file has no head path and is
 * left out, since a stop can only point at head lines.
 */
export function parseDiff(diff: string): ReadonlyMap<string, FileDiff> {
  const files = new Map<
    string,
    { newFile: boolean; added: number; removed: number; lines: DiffLine[] }
  >();
  let file: { newFile: boolean; added: number; removed: number; lines: DiffLine[] } | undefined;
  let newFile = false;
  let inHeader = false;
  let base = 0;
  let head = 0;
  for (const line of diff.split('\n')) {
    if (line.startsWith('diff --git ')) {
      [file, newFile, inHeader] = [undefined, false, true];
      continue;
    }
    if (inHeader) {
      if (line.startsWith('new file mode')) newFile = true;
      const path = NEW_SIDE.exec(line);
      if (path?.[1] !== undefined) {
        file = { newFile, added: 0, removed: 0, lines: [] };
        files.set(path[1], file);
      }
    }
    const hunk = HUNK.exec(line);
    if (hunk) {
      [inHeader, base, head] = [false, Number(hunk[1]), Number(hunk[2])];
      continue;
    }
    if (inHeader || file === undefined) continue;
    const text = line.slice(1);
    if (line.startsWith('+')) {
      file.lines.push({ kind: 'added', head: head++, text });
      file.added++;
    } else if (line.startsWith('-')) {
      file.lines.push({ kind: 'removed', base: base++, text });
      file.removed++;
    } else if (line.startsWith(' ')) {
      file.lines.push({ kind: 'context', head: head++, text });
      base++;
    }
  }
  return files;
}

/**
 * The lines a stop shows of one file: each range's head lines, with the removed lines the diff
 * puts right before a head line in the range, and a gap between ranges. `headLines` is the file
 * at the head commit, for a file the diff doesn't show (unchanged, or lines outside its hunks).
 */
export function cutStopLines(
  ref: CodeRef,
  diff: FileDiff | undefined,
  headLines: readonly string[],
): TourLine[] {
  const changes = changesByHeadLine(diff);
  return ref.ranges.flatMap((range, index) => {
    const gap: TourLine[] =
      index > 0 || range.label ? [{ kind: 'gap', text: range.label ?? '' }] : [];
    const lines = lineNumbers(range.from, range.to).flatMap((number): TourLine[] => {
      const text = headLines[number - 1];
      if (text === undefined) {
        throw new Error(
          `${ref.file} has ${headLines.length} lines at the head commit; line ${number} doesn't exist`,
        );
      }
      const change = changes.get(number);
      return [
        ...(change?.removedBefore ?? []),
        {
          kind: change?.added ? 'added' : 'context',
          number,
          text,
          highlighted: ref.highlight.includes(number),
        },
        ...(change?.removedAfter ?? []),
      ];
    });
    return [...gap, ...lines];
  });
}

interface HeadLineChange {
  readonly added: boolean;
  readonly removedBefore: readonly TourLine[];
  /** Lines removed at the end of the file, which no head line follows. */
  readonly removedAfter?: readonly TourLine[];
}

function changesByHeadLine(diff: FileDiff | undefined): ReadonlyMap<number, HeadLineChange> {
  const changes = new Map<number, HeadLineChange>();
  let removed: TourLine[] = [];
  let last: number | undefined;
  for (const line of diff?.lines ?? []) {
    if (line.kind === 'removed') {
      removed.push({ kind: 'removed', number: line.base, text: line.text, highlighted: false });
      continue;
    }
    changes.set(line.head, { added: line.kind === 'added', removedBefore: removed });
    [removed, last] = [[], line.head];
  }
  const lastChange = last === undefined ? undefined : changes.get(last);
  if (last !== undefined && lastChange && removed.length > 0) {
    changes.set(last, { ...lastChange, removedAfter: removed });
  }
  return changes;
}

function lineNumbers(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, offset) => from + offset);
}

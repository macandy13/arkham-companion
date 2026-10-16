/**
 * Line numbers each file gained or changed in a PR, keyed by repo-relative path. Built
 * from `git diff --unified=0` by {@link parseChangedLines}; deleted lines are not part of
 * it, since nothing can cover a line that no longer exists.
 */
export type ChangedLines = ReadonlyMap<string, readonly number[]>;

const NEW_FILE_HEADER = /^\+\+\+ (?:b\/(.+)|\/dev\/null)$/;
const HUNK_HEADER = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;

/**
 * Parses a `git diff --unified=0` into the new-side line numbers of every hunk. Hunk
 * headers carry the ranges, so the `+` lines themselves are never read; file headers are
 * only looked for between `diff --git` and the first hunk, so an added line that happens
 * to read `++ b/…` is not taken for one.
 */
export function parseChangedLines(diff: string): ChangedLines {
  const changed = new Map<string, number[]>();
  let lines: number[] | undefined;
  let inFileHeader = false;
  for (const line of diff.split('\n')) {
    if (line.startsWith('diff --git ')) {
      inFileHeader = true;
      lines = undefined;
      continue;
    }
    const fileHeader = inFileHeader ? NEW_FILE_HEADER.exec(line) : null;
    if (fileHeader?.[1] !== undefined) {
      lines = [];
      changed.set(fileHeader[1], lines);
      continue;
    }
    const hunk = HUNK_HEADER.exec(line);
    if (!hunk) continue;
    inFileHeader = false;
    lines?.push(...lineRange(Number(hunk[1]), Number(hunk[2] ?? 1)));
  }
  return changed;
}

function lineRange(start: number, count: number): number[] {
  return Array.from({ length: count }, (_, offset) => start + offset);
}

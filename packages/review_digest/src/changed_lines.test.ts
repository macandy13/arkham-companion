import { describe, expect, it } from 'vitest';
import { parseChangedLines } from './changed_lines.ts';

describe('parseChangedLines', () => {
  it('lists the new-side lines of every hunk per file', () => {
    const diff = [
      'diff --git a/packages/engine/src/doom.ts b/packages/engine/src/doom.ts',
      '--- a/packages/engine/src/doom.ts',
      '+++ b/packages/engine/src/doom.ts',
      '@@ -10,0 +11,2 @@ export function doomInPlay(',
      '+  const onCards = 1;',
      '+  return onCards;',
      '@@ -40 +42 @@',
      '-old',
      '+new',
      'diff --git a/packages/engine/src/act.ts b/packages/engine/src/act.ts',
      '--- a/packages/engine/src/act.ts',
      '+++ b/packages/engine/src/act.ts',
      '@@ -5 +5 @@',
      '-a',
      '+b',
    ].join('\n');

    const changed = parseChangedLines(diff);

    expect(Object.fromEntries(changed)).toEqual({
      'packages/engine/src/doom.ts': [11, 12, 42],
      'packages/engine/src/act.ts': [5],
    });
  });

  it('gives a file with only deletions no changed lines', () => {
    const diff = [
      'diff --git a/packages/engine/src/doom.ts b/packages/engine/src/doom.ts',
      '--- a/packages/engine/src/doom.ts',
      '+++ b/packages/engine/src/doom.ts',
      '@@ -10,2 +9,0 @@',
      '-gone',
      '-also gone',
    ].join('\n');

    const changed = parseChangedLines(diff);

    expect(changed.get('packages/engine/src/doom.ts')).toEqual([]);
  });

  it('leaves out deleted files', () => {
    const diff = [
      'diff --git a/packages/engine/src/old.ts b/packages/engine/src/old.ts',
      '--- a/packages/engine/src/old.ts',
      '+++ /dev/null',
      '@@ -1,2 +0,0 @@',
      '-gone',
      '-also gone',
    ].join('\n');

    const changed = parseChangedLines(diff);

    expect(changed.size).toBe(0);
  });

  it('does not take an added line that reads like a file header for one', () => {
    const diff = [
      'diff --git a/docs/notes.md b/docs/notes.md',
      '--- a/docs/notes.md',
      '+++ b/docs/notes.md',
      '@@ -1,0 +2,2 @@',
      '+++ b/not_a_file.md',
      '+second added line',
    ].join('\n');

    const changed = parseChangedLines(diff);

    expect(Object.fromEntries(changed)).toEqual({ 'docs/notes.md': [2, 3] });
  });
});

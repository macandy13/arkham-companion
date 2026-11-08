// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { decisionId, instanceId } from '@arkham/engine';
import { useJustDrawn, type ResolvingShown } from './justDrawn';

/** Hands each render's `useJustDrawn` to `seen`. */
function Probe({
  shown,
  seen,
}: {
  shown: ResolvingShown | undefined;
  seen: (justDrawn: boolean) => void;
}) {
  seen(useJustDrawn(shown));
  return null;
}

/**
 * What `useJustDrawn` reports last for each of `steps`, shown one after another (a change renders
 * twice, since the hook keeps it in its state).
 */
function justDrawnWhile(steps: readonly (ResolvingShown | undefined)[]): boolean[] {
  let last = false;
  const seen = (justDrawn: boolean) => (last = justDrawn);
  const { rerender } = render(<Probe shown={steps[0]} seen={seen} />);
  const reported = [last];
  for (const shown of steps.slice(1)) {
    rerender(<Probe shown={shown} seen={seen} />);
    reported.push(last);
  }
  return reported;
}

const crypt_chill = instanceId('crypt_chill');
const ancient_evils = instanceId('ancient_evils');
const test_willpower = decisionId('test_willpower');
const take_damage = decisionId('take_damage');

describe('useJustDrawn', () => {
  afterEach(cleanup);

  it.each<[string, (ResolvingShown | undefined)[], boolean[]]>([
    [
      'a card drawn while the game shows: its first decision, also when shown again',
      [
        {},
        { card: crypt_chill, decision: test_willpower },
        { card: crypt_chill, decision: test_willpower },
      ],
      [false, true, true],
    ],
    [
      'the next decision of the same card: none',
      [
        {},
        { card: crypt_chill, decision: test_willpower },
        { card: crypt_chill, decision: take_damage },
      ],
      [false, true, false],
    ],
    [
      'the next card drawn: its first decision',
      [
        {},
        { card: crypt_chill, decision: test_willpower },
        { card: ancient_evils, decision: take_damage },
      ],
      [false, true, true],
    ],
    [
      'a game opened with the card already drawn: none',
      [{ card: crypt_chill, decision: test_willpower }],
      [false],
    ],
    [
      'a game that loads after the screen mounts (a reload): none',
      [
        undefined,
        { card: crypt_chill, decision: test_willpower },
        { card: crypt_chill, decision: test_willpower },
      ],
      [false, false, false],
    ],
    ['a card drawn without a decision: none', [{}, { card: ancient_evils }], [false, false]],
    [
      'a decision without a card being resolved: none',
      [{ card: crypt_chill }, { decision: take_damage }],
      [false, false],
    ],
  ])('%s', (_case, steps, justDrawn) => {
    expect(justDrawnWhile(steps)).toEqual(justDrawn);
  });
});

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { STATE_VERSION, instanceId, replay, type Event, type StoredEvent } from '@arkham/engine';
import { GameImportError, parseGameExport, serialiseGameExport } from './gameExport';

const started: Event = {
  type: 'ScenarioStarted',
  scenarioId: 'test',
  difficulty: 'standard',
  seed: 7,
  investigators: [],
  maps: {},
  cards: [
    {
      id: instanceId('c1'),
      code: '0001',
      zone: { kind: 'encounterDeck' },
      faceUp: false,
      exhausted: false,
      tokens: {},
      flags: {},
    },
  ],
  chaosBag: ['0', 'skull'],
};

const doom = (delta: number): Event => ({
  type: 'TokensChanged',
  cardId: instanceId('c1'),
  token: 'doom',
  delta,
});

const stored = (events: Event[]): StoredEvent[] =>
  events.map((event, i) => ({ gameId: 'g', seq: i + 1, timestamp: 1000 + i, event }));

/** The failure reason of `parseGameExport`, or `undefined` if the text was accepted. */
function failureOf(text: string) {
  try {
    parseGameExport(text);
  } catch (error) {
    return error instanceof GameImportError ? error.reason : 'other';
  }
  return undefined;
}

describe('game export format', () => {
  it('parses what it serialises, keeping title and timestamps', () => {
    const text = serialiseGameExport('Night', 5, stored([started]));
    expect(parseGameExport(text)).toEqual({
      title: 'Night',
      events: [{ timestamp: 1000, event: started }],
    });
  });

  it('property: replaying a parsed export gives the state of the original events', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 5 }).map(doom)), (rest) => {
        const events = [started, ...rest];
        const parsed = parseGameExport(serialiseGameExport('t', 0, stored(events)));
        expect(replay(parsed.events.map((e) => e.event))).toEqual(replay(events));
      }),
    );
  });

  it('rejects an export from a newer state version', () => {
    const text = JSON.stringify({
      ...JSON.parse(serialiseGameExport('t', 0, stored([started]))),
      stateVersion: STATE_VERSION + 1,
    });
    expect(failureOf(text)).toBe('newerVersion');
  });

  it('rejects text that is not JSON, other JSON and unknown events', () => {
    expect(failureOf('not json')).toBe('invalid');
    expect(failureOf('{"format":"other","stateVersion":1}')).toBe('invalid');
    const unknownEvent = serialiseGameExport(
      't',
      0,
      stored([{ type: 'Nope' } as unknown as Event]),
    );
    expect(failureOf(unknownEvent)).toBe('invalid');
  });
});

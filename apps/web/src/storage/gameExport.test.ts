import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  STATE_VERSION,
  cardCode,
  gameId,
  scenarioId,
  instanceId,
  replay,
  type Event,
  type StoredEvent,
} from '@arkham/engine';
import { parseGameExport, serialiseGameExport } from './gameExport';
import { GameImportError } from './importError';

const started: Event = {
  type: 'ScenarioStarted',
  scenarioId: scenarioId('test'),
  difficulty: 'standard',
  seed: 7,
  investigators: [],
  maps: {},
  cards: [
    {
      id: instanceId('c1'),
      code: cardCode('0001'),
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
  events.map((event, i) => ({
    gameId: gameId('g'),
    seq: i + 1,
    timestamp: 1000 + i,
    commandId: `command_${i + 1}`,
    event,
  }));

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
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses what it serialises, keeping title, timestamps and command ids', () => {
    const text = serialiseGameExport('Night', 5, stored([started]));
    expect(parseGameExport(text)).toEqual({
      title: 'Night',
      events: [{ timestamp: 1000, commandId: 'command_1', event: started }],
    });
  });

  it("keeps the cause of an event the game did by itself, and none for the players' own", () => {
    const mythosDoom = { kind: 'rule', step: 'placeDoom' } as const;
    const [scenarioStart, placedDoom] = stored([started, doom(1)]);
    const events = [scenarioStart!, { ...placedDoom!, cause: mythosDoom }];

    const parsed = parseGameExport(serialiseGameExport('Night', 5, events));

    expect(parsed.events.map((e) => e.cause)).toEqual([undefined, mythosDoom]);
  });

  it('rejects a cause the log could not word', () => {
    const [scenarioStart] = stored([started]);
    const text = serialiseGameExport('Night', 5, [scenarioStart!]).replace(
      '"event":',
      '"cause":{"kind":"rule","step":"unknownStep"},"event":',
    );

    expect(failureOf(text)).toBe('invalid');
  });

  it.each([
    { name: 'no further events', deltas: [] },
    { name: 'one event', deltas: [2] },
    { name: 'several events including a zero delta', deltas: [0, 3, 5, 1] },
  ])('replaying a parsed export gives the original state ($name)', ({ deltas }) => {
    const events = [started, ...deltas.map(doom)];
    const parsed = parseGameExport(serialiseGameExport('t', 0, stored(events)));
    expect(replay(parsed.events.map((e) => e.event))).toEqual(replay(events));
  });

  it('rejects an export from a newer state version', () => {
    const text = JSON.stringify({
      ...JSON.parse(serialiseGameExport('t', 0, stored([started]))),
      stateVersion: STATE_VERSION + 1,
    });
    expect(failureOf(text)).toBe('newerVersion');
  });

  it('rejects text that is not JSON, other JSON and unknown events', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(failureOf('not json')).toBe('invalid');
    expect(failureOf('{"format":"other","stateVersion":1}')).toBe('invalid');
    const unknownEvent = serialiseGameExport(
      't',
      0,
      stored([{ type: 'Nope' } as unknown as Event]),
    );
    expect(failureOf(unknownEvent)).toBe('invalid');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('not valid JSON'), expect.any(Error));
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('does not replay'),
      expect.any(Error),
    );
  });
});

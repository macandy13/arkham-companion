import { afterEach, describe, expect, it, vi } from 'vitest';
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
  events.map((event, i) => ({
    gameId: 'g',
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

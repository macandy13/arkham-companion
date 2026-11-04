// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { blankLocation, instanceId, investigatorId, newGame, PlayTable } from '@arkham/engine';
import { swipeAction } from './detailSwipe';

describe('swipeAction', () => {
  const study = instanceId('study');
  const board = PlayTable.start(
    newGame()
      .withLocation(study, blankLocation('study'))
      .withInvestigator(investigatorId('alder'), { locationId: study })
      .withInvestigator(investigatorId('brook'), { locationId: study }),
  ).board;

  // The phone board's parts a swipe can start on: the act and the header's label, Alder's panel
  // and the investigator bar's empty end, where Brook's panel is the one the phone shows.
  document.body.innerHTML = `
    <main id="board">
      <header>
        <section data-slot="act"><h2 id="act">Act</h2></section>
        <h2 id="header_label">Scenario</h2>
      </header>
      <section id="investigators">
        <section data-investigator="alder"><h3 id="alder">Alder</h3></section>
        <section data-investigator="brook" data-focus><h3>Brook</h3></section>
        <p id="bar_end"></p>
      </section>
      <section id="map"><p id="map_place"></p></section>
    </main>`;
  const element = (id: string) => document.getElementById(id) as Element;

  it.each([
    {
      swipe: 'down on the act',
      on: 'act',
      direction: 'down',
      shown: undefined,
      scrolled: false,
      action: { row: 'cards', card: 'act' },
    },
    {
      swipe: "down on the header's label",
      on: 'header_label',
      direction: 'down',
      shown: undefined,
      scrolled: false,
      action: { row: 'cards', card: 'agenda' },
    },
    {
      swipe: 'down on the expanded header',
      on: 'act',
      direction: 'down',
      shown: 'cards',
      scrolled: false,
      action: undefined,
    },
    {
      swipe: 'up on the expanded header',
      on: 'act',
      direction: 'up',
      shown: 'cards',
      scrolled: false,
      action: 'close',
    },
    {
      swipe: 'up on the compact header',
      on: 'act',
      direction: 'up',
      shown: undefined,
      scrolled: false,
      action: undefined,
    },
    {
      swipe: "up on Alder's panel",
      on: 'alder',
      direction: 'up',
      shown: undefined,
      scrolled: false,
      action: { row: 'investigators', investigator: 'alder' },
    },
    {
      swipe: "up on the bar's empty end",
      on: 'bar_end',
      direction: 'up',
      shown: undefined,
      scrolled: false,
      action: { row: 'investigators', investigator: 'brook' },
    },
    {
      swipe: 'down on the expanded bar',
      on: 'alder',
      direction: 'down',
      shown: 'investigators',
      scrolled: false,
      action: 'close',
    },
    {
      swipe: 'down on the expanded bar scrolled down',
      on: 'alder',
      direction: 'down',
      shown: 'investigators',
      scrolled: true,
      action: undefined,
    },
    {
      swipe: 'down on the compact bar',
      on: 'alder',
      direction: 'down',
      shown: undefined,
      scrolled: false,
      action: undefined,
    },
    {
      swipe: 'down on the map',
      on: 'map_place',
      direction: 'down',
      shown: undefined,
      scrolled: false,
      action: undefined,
    },
  ] as const)('a swipe $swipe gives $action', ({ on, direction, shown, scrolled, action }) => {
    expect(swipeAction({ direction, on: element(on), scrolled }, shown, board)).toEqual(action);
  });
});

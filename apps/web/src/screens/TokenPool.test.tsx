// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  atLocation,
  blankEnemy,
  blankLocation,
  fixed,
  instanceId,
  investigatorId,
  newGame,
  PlayTable,
} from '@arkham/engine';
import { initI18n } from '../i18n';
import { actionsOn } from '../state/gameActions.test_support';
import { TokenPool } from './TokenPool';

const study = instanceId('study');
const ghoul = instanceId('ghoul');
const alder = investigatorId('alder');

/** Alder in the study with a ghoul of health 3 there. */
const studyWithGhoul = () =>
  PlayTable.start(
    newGame()
      .withLocation(study, blankLocation('study'), { revealed: true })
      .withInvestigator(alder, { locationId: study })
      .withCard(ghoul, blankEnemy('ghoul', { health: fixed(3) }), atLocation(study)),
  );

// jsdom lays nothing out and has no pointer capture: the hit test under the pointer finds what a
// test puts under it (`underPointer`), and capture is stubbed.
describe('TokenPool', () => {
  let underPointer: Element | null = null;
  beforeAll(async () => {
    await initI18n('en');
  });
  beforeEach(() => {
    underPointer = null;
    document.elementFromPoint = () => underPointer;
    Object.assign(HTMLElement.prototype, { setPointerCapture: () => {} });
  });
  afterEach(() => {
    cleanup();
    const element: object = HTMLElement.prototype;
    Reflect.deleteProperty(document, 'elementFromPoint');
    Reflect.deleteProperty(element, 'setPointerCapture');
  });

  /** Drags the pool's token named `name` off the pool and lets go over `underPointer`. */
  async function dragOffPool(name: string) {
    const token = screen.getByRole('img', { name });
    fireEvent.pointerDown(token, { pointerId: 1, clientX: 20, clientY: 20 });
    fireEvent.pointerMove(token, { pointerId: 1, clientX: 300, clientY: 300 });
    fireEvent.pointerUp(token, { pointerId: 1, clientX: 300, clientY: 300 });
    await act(async () => {});
  }

  it.each([
    { token: 'Damage from the pool', damage: 1, horror: 0, resources: 0 },
    { token: 'Horror from the pool', damage: 0, horror: 1, resources: 0 },
    { token: 'Resource from the pool', damage: 0, horror: 0, resources: 1 },
  ])(
    '"$token" dropped on Alder’s card gives Alder $damage damage, $horror horror and $resources more resources',
    async ({ token, damage, horror, resources }) => {
      const table = studyWithGhoul();
      const resourcesBefore = table.board.investigator(alder).resources;
      render(
        <>
          <TokenPool actions={actionsOn(table)} busy={false} adjusting={false} />
          <section data-investigator="alder">
            <h3>alder</h3>
          </section>
        </>,
      );
      underPointer = screen.getByRole('heading', { name: 'alder' });

      await dragOffPool(token);

      expect(table.board.investigator(alder)).toMatchObject({
        damage,
        horror,
        resources: resourcesBefore + resources,
      });
    },
  );

  it('deals 1 damage to the ghoul a damage token is dropped on, not to Alder', async () => {
    const table = studyWithGhoul();
    render(
      <>
        <TokenPool actions={actionsOn(table)} busy={false} adjusting={false} />
        <section data-investigator="alder">
          <ul>
            <li data-enemy="ghoul">ghoul</li>
          </ul>
        </section>
      </>,
    );
    underPointer = screen.getByText('ghoul');

    await dragOffPool('Damage from the pool');

    expect(table.board.enemy(ghoul).damage).toBe(1);
    expect(table.board.investigator(alder).damage).toBe(0);
  });

  it('places a doom dropped on the ghoul’s card in a threat area on the ghoul, not on the study', async () => {
    const table = studyWithGhoul();
    render(
      <>
        <TokenPool actions={actionsOn(table)} busy={false} adjusting={false} />
        <ul>
          <li data-enemy="ghoul">ghoul</li>
        </ul>
      </>,
    );
    underPointer = screen.getByText('ghoul');

    await dragOffPool('Doom from the pool');

    expect(table.board.enemy(ghoul).doom).toBe(1);
    expect(table.board.location(study).doom).toBeUndefined();
  });

  it('places nothing when a damage token is dropped on neither an investigator nor an enemy', async () => {
    const table = studyWithGhoul();
    render(<TokenPool actions={actionsOn(table)} busy={false} adjusting={false} />);

    await dragOffPool('Damage from the pool');

    expect(table.board.enemy(ghoul).damage ?? 0).toBe(0);
    expect(table.board.investigator(alder).damage).toBe(0);
  });
});

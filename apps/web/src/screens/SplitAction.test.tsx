// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SplitAction } from './SplitAction';

const tap = (name: string) => fireEvent.click(screen.getByRole('button', { name }));
const menuLines = () =>
  screen
    .getAllByRole('button')
    .filter((button) => button.closest('ul') !== null)
    .map((button) => button.textContent);

describe('SplitAction', () => {
  afterEach(cleanup);

  /** A fight as an action, with a free fight and one by card effect for daisy as its ways. */
  const renderFight = (withPrimary: boolean) => {
    const picked = vi.fn<(way: string) => void>();
    render(
      <SplitAction
        icon="fight"
        caption="Fight"
        waysName="Ways to fight"
        {...(withPrimary
          ? {
              primary: {
                key: 'action',
                actions: 1,
                name: 'Fight · 1 action',
                onPick: () => picked('action'),
              },
            }
          : {})}
        ways={[
          { key: 'free', actions: 0, name: 'Fight, no action', onPick: () => picked('free') },
          { key: 'daisy', name: 'Fight by card effect · daisy', onPick: () => picked('daisy') },
        ]}
        disabled={false}
      />,
    );
    return picked;
  };

  it('fights as an action on a tap of the pill, without opening its ways', () => {
    const picked = renderFight(true);

    tap('Fight · 1 action');

    expect(picked).toHaveBeenCalledWith('action');
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('lists the action first, then the other ways, and closes once one is picked', () => {
    const picked = renderFight(true);

    tap('Ways to fight');
    const lines = menuLines();
    fireEvent.click(screen.getByText('Fight by card effect · daisy'));

    expect(lines).toEqual(['Fight · 1 action', 'Fight, no action', 'Fight by card effect · daisy']);
    expect(picked).toHaveBeenCalledWith('daisy');
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('opens the ways from the pill itself when there is no action to take', () => {
    renderFight(false);

    tap('Ways to fight');

    expect(menuLines()).toEqual(['Fight, no action', 'Fight by card effect · daisy']);
  });

  it.each([
    { close: 'Escape', act: () => fireEvent.keyDown(screen.getByRole('list'), { key: 'Escape' }) },
    { close: 'a press elsewhere', act: () => fireEvent.pointerDown(document.body) },
  ])('closes its ways on $close without picking one', ({ act }) => {
    const picked = renderFight(true);

    tap('Ways to fight');
    act();

    expect(screen.queryByRole('list')).toBeNull();
    expect(picked).not.toHaveBeenCalled();
  });
});

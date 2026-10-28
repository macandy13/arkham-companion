// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cardImagePath, cardName, instanceId, trait, type CardFaceView } from '@arkham/engine';
import { initI18n } from '../i18n';
import { CardZoom } from './CardZoom';
import { useDetailView } from './useDetailView';

describe('CardZoom', () => {
  beforeAll(async () => {
    await initI18n('en');
  });
  afterEach(cleanup);

  it('reads a card without a picture from its name, type and traits', () => {
    const plainCurse: CardFaceView = {
      id: instanceId('plain_curse'),
      name: cardName('plain_curse'),
      type: 'treachery',
      traits: [trait('Curse'), trait('Omen')],
    };

    render(<CardZoom card={plainCurse} onClose={() => {}} />);

    const zoom = within(screen.getByRole('dialog', { name: 'plain_curse' }));
    expect(zoom.getByRole('heading', { name: 'plain_curse' })).toBeTruthy();
    expect(zoom.getByText('Treachery')).toBeTruthy();
    expect(zoom.getByText('Curse. Omen.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Turn it over' })).toBeNull();
  });

  it('shows the picture of the front once it has loaded, and turns over to the back', () => {
    const twoSidedCurse: CardFaceView = {
      id: instanceId('two_sided_curse'),
      name: cardName('two_sided_curse'),
      type: 'treachery',
      traits: [],
      image: cardImagePath('/bundles/cards/curse_front.png'),
      backImage: cardImagePath('/bundles/cards/curse_back.png'),
    };
    render(<CardZoom card={twoSidedCurse} onClose={() => {}} />);
    const front = screen.getByRole('img', { name: 'The front of two_sided_curse' });
    fireEvent.load(front);
    const shownAfterLoad = front.closest('article')?.getAttribute('data-picture');

    fireEvent.click(screen.getByRole('button', { name: 'Turn it over' }));

    const back = screen.getByRole('img', { name: 'The back of two_sided_curse' });
    expect(shownAfterLoad).toBe('shown');
    expect(back.getAttribute('src')).toBe('https://arkhamdb.com/bundles/cards/curse_back.png');
    expect(back.closest('article')?.hasAttribute('data-picture')).toBe(false);
    expect(screen.getByRole('button', { name: 'Turn it back' })).toBeTruthy();
  });

  it('closes with its × button', () => {
    let closed = false;
    render(
      <CardZoom
        card={{
          id: instanceId('plain_curse'),
          name: cardName('plain_curse'),
          type: 'treachery',
          traits: [],
        }}
        onClose={() => {
          closed = true;
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(closed).toBe(true);
  });
});

describe('CardZoom on a phone held upright', () => {
  const plainCurse: CardFaceView = {
    id: instanceId('plain_curse'),
    name: cardName('plain_curse'),
    type: 'treachery',
    traits: [],
  };

  beforeAll(async () => {
    await initI18n('en');
  });
  beforeEach(() => {
    // jsdom has no media queries, so the zoom is told it is on a phone.
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  });
  afterEach(() => {
    // Off the card's entry first, so a zoom left open drops nothing into the next test.
    window.history.replaceState(null, '');
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('closes on the back gesture, which leaves the entry it opened', () => {
    const onClose = vi.fn();
    render(<CardZoom card={plainCurse} onClose={onClose} />);
    const opened = window.history.state;

    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(opened).toEqual({ cardView: expect.any(String) });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('steps back through the history once from its × button, however often it is tapped', () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const onClose = vi.fn();
    render(<CardZoom card={plainCurse} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(back).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
  });

  /**
   * The detail view with buttons that open the curse zoomed over it, close the view, and take the
   * curse away while it is open, as when its card leaves play.
   */
  function CurseOverTheDetailView() {
    const detail = useDetailView();
    const [zoomed, setZoomed] = useState(false);
    return (
      <>
        <p>{detail.target ? 'Detail view' : 'Overview'}</p>
        <button type="button" onClick={() => detail.open({ row: 'map' })}>
          Open the detail view
        </button>
        <button type="button" onClick={detail.close}>
          Close the detail view
        </button>
        <button type="button" onClick={() => setZoomed(true)}>
          Zoom the curse
        </button>
        <button type="button" onClick={() => setZoomed(false)}>
          Take the curse away
        </button>
        {zoomed && <CardZoom card={plainCurse} onClose={() => setZoomed(false)} />}
      </>
    );
  }

  it('closes on its × over the detail view, which stays open', async () => {
    render(<CurseOverTheDetailView />);
    fireEvent.click(screen.getByRole('button', { name: 'Open the detail view' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zoom the curse' }));

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText('Detail view')).toBeTruthy();
  });

  it('drops its entry as it goes while open, so the detail view still closes with its ×', async () => {
    render(<CurseOverTheDetailView />);
    fireEvent.click(screen.getByRole('button', { name: 'Open the detail view' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zoom the curse' }));
    fireEvent.click(screen.getByRole('button', { name: 'Take the curse away' }));
    await waitFor(() => expect(window.history.state).not.toHaveProperty('cardView'));

    fireEvent.click(screen.getByRole('button', { name: 'Close the detail view' }));

    await waitFor(() => expect(screen.getByText('Overview')).toBeTruthy());
  });
});

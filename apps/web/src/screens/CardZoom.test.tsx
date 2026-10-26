// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cardImagePath, cardName, trait, type CardFaceView } from '@arkham/engine';
import { initI18n } from '../i18n';
import { CardZoom } from './CardZoom';

describe('CardZoom', () => {
  beforeAll(async () => {
    await initI18n('en');
  });
  afterEach(cleanup);

  it('reads a card without a picture from its name, type and traits', () => {
    const plainCurse: CardFaceView = {
      name: cardName('plain_curse'),
      type: 'treachery',
      traits: [trait('Curse'), trait('Omen')],
    };

    render(<CardZoom card={plainCurse} onClose={() => {}} />);

    const zoom = screen.getByRole('dialog', { name: 'plain_curse' });
    expect(zoom.querySelector('article')?.textContent).toBe('plain_curseTreacheryCurse. Omen.');
    expect(screen.queryByRole('button', { name: 'Turn it over' })).toBeNull();
  });

  it('shows the picture of the front once it has loaded, and turns over to the back', () => {
    const twoSidedCurse: CardFaceView = {
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
        card={{ name: cardName('plain_curse'), type: 'treachery', traits: [] }}
        onClose={() => {
          closed = true;
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(closed).toBe(true);
  });
});

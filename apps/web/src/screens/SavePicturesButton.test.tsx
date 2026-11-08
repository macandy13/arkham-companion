// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  blankLocation,
  cardImagePath,
  instanceId,
  investigatorId,
  newGame,
  PlayTable,
} from '@arkham/engine';
import { initI18n } from '../i18n';
import { SavePicturesButton } from './SavePicturesButton';

describe('SavePicturesButton', () => {
  beforeAll(async () => {
    await initI18n('en');
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('fetches the pictures of the game and says how many it saved', async () => {
    const fetched: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => fetched.push(url));
    const study = instanceId('study');
    const table = PlayTable.start(
      newGame()
        .withLocation(
          study,
          blankLocation('study', { imageSrc: cardImagePath('/cards/study.png') }),
        )
        .withInvestigator(investigatorId('roland'), {
          locationId: study,
          imageSrc: cardImagePath('/cards/roland.png'),
        }),
    );
    render(<SavePicturesButton board={table.board} />);

    fireEvent.click(screen.getByRole('button', { name: 'Save pictures for offline play' }));

    expect(await screen.findByRole('button', { name: 'Pictures saved: 2 of 2' })).toBeTruthy();
    expect(fetched).toEqual([
      'https://arkhamdb.com/cards/study.png',
      'https://arkhamdb.com/cards/roland.png',
    ]);
  });

  it('says how many pictures failed, for a tap to try again', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', async (url: string) => {
      if (url.endsWith('study.png')) throw new TypeError('Failed to fetch');
    });
    const study = instanceId('study');
    const table = PlayTable.start(
      newGame()
        .withLocation(
          study,
          blankLocation('study', { imageSrc: cardImagePath('/cards/study.png') }),
        )
        .withInvestigator(investigatorId('roland'), {
          locationId: study,
          imageSrc: cardImagePath('/cards/roland.png'),
        }),
    );
    render(<SavePicturesButton board={table.board} />);

    fireEvent.click(screen.getByRole('button', { name: 'Save pictures for offline play' }));

    expect(
      await screen.findByRole('button', {
        name: 'Pictures saved: 1 of 2, 1 failed. Tap to try again',
      }),
    ).toBeTruthy();
  });
});

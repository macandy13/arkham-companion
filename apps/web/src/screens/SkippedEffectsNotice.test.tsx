// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initI18n } from '../i18n';
import { SkippedEffectsNotice } from './SkippedEffectsNotice';

describe('SkippedEffectsNotice', () => {
  beforeAll(() => initI18n('en'));
  afterEach(cleanup);

  it('names the card, the skipped effect and the missing card, and asks to do it by hand', () => {
    render(
      <SkippedEffectsNotice
        skipped={[{ card: 'The Barrier', effect: 'SpawnEnemy', missing: ['Ghoul Priest'] }]}
        onDismiss={() => {}}
      />,
    );

    expect(screen.getByRole('status', { name: 'Do this by hand' }).textContent).toContain(
      'The Barrier: spawning the enemy was skipped because Ghoul Priest is not in the game exactly once. Please do it by hand.',
    );
  });

  it('falls back to a general text for an effect without its own', () => {
    render(
      <SkippedEffectsNotice
        skipped={[{ card: 'The Barrier', effect: 'PlaceDoom', missing: ['Parlor'] }]}
        onDismiss={() => {}}
      />,
    );

    expect(screen.getByRole('status').textContent).toContain('The Barrier: an effect was skipped');
  });

  it('is dismissed with OK', () => {
    const onDismiss = vi.fn();
    render(
      <SkippedEffectsNotice
        skipped={[{ card: 'The Barrier', effect: 'SpawnEnemy', missing: ['Ghoul Priest'] }]}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'OK' }));

    expect(onDismiss).toHaveBeenCalledOnce();
  });
});

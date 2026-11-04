// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initI18n } from '../i18n';
import { Token } from './Token';

describe('Token', () => {
  beforeAll(async () => {
    await initI18n('en');
  });
  afterEach(cleanup);

  it('marks a count that changed while shown with its change, outside its text', () => {
    const { rerender } = render(<Token kind="doom" count={1} label="1 doom" />);

    rerender(<Token kind="doom" count={2} label="2 doom" />);

    const token = screen.getByRole('img', { name: '2 doom' });
    expect(token.querySelector('data')?.dataset.delta).toBe('+1');
    expect(token.textContent).toBe('2');
  });

  it('marks nothing on the count first shown', () => {
    render(<Token kind="doom" count={1} label="1 doom" />);

    expect(screen.getByRole('img', { name: '1 doom' }).querySelector('[data-delta]')).toBeNull();
  });

  it.each([
    { kind: 'doom', label: '1 doom', tentacles: true },
    { kind: 'clue', label: '1 clue', tentacles: false },
  ] as const)(
    'draws the tentacles only on a doom token: $kind → $tentacles',
    ({ kind, label, tentacles }) => {
      render(<Token kind={kind} count={1} label={label} />);

      const mark = screen
        .getByRole('img', { name: label })
        .querySelector('[data-part="doom-mark"]');
      expect(mark !== null).toBe(tentacles);
    },
  );
});

// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { initI18n } from '../i18n';
import { ChaosTokenFace } from './ChaosTokenFace';

describe('ChaosTokenFace', () => {
  beforeAll(async () => {
    await initI18n('en');
  });
  afterEach(cleanup);

  it.each([
    { token: '-2', text: '−2' },
    { token: 'elderSign', text: 'Elder Sign' },
  ] as const)('marks the $token token for its face and says $text', ({ token, text }) => {
    render(<ChaosTokenFace token={token} />);

    expect(screen.getByText(text).dataset.chaosFace).toBe(token);
  });
});

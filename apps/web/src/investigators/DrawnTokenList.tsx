import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChaosToken } from '@arkham/engine';
import { ChaosTokenFace } from '../tokens/ChaosTokenFace';
import { hasSymbol, signedOrUnknown } from '../tokens/tokenValue';
import type { DrawnTokenAction } from './drawn_token_action';
import type { SkillTestRun } from './TestCalculation';

/**
 * The tokens drawn for a skill test, in the order they came out (ME.24b). Each shows as the token
 * it counts as, with the effect of its symbol under it while it resolves; a token a card changed
 * says so ("Cancelled", "Ignored", "was Elder Sign"). Tapping one opens what a card can do to it:
 * cancel or ignore it (or resolve it again), redraw it, or treat it as another token
 * (`SkillTestRun.act`). Once the draw is done, "Reveal another" draws one more as a card says.
 * `effects` are the modifiers of the resolved tokens in order (`undefined` where a card decides).
 */
export function DrawnTokenList({
  run,
  effects,
}: {
  run: Pick<SkillTestRun, 'drawn' | 'act' | 'revealAnother' | 'treatOptions'>;
  effects: readonly (number | undefined)[];
}) {
  const { t } = useTranslation();
  const listId = useId();
  const [open, setOpen] = useState<number>();
  const name = (token: ChaosToken) => t(`chaosToken.${token}`);
  const act = (index: number, action: DrawnTokenAction) => {
    setOpen(undefined);
    run.act(index, action);
  };
  let resolvedIndex = 0;
  const chosen = open === undefined ? undefined : run.drawn[open];
  return (
    <>
      <ol id={listId} aria-label={t('skillTest.drawn')}>
        {run.drawn.map((drawn, index) => {
          const shown = drawn.treatedAs ?? drawn.token;
          const effect = drawn.state === 'resolved' ? effects[resolvedIndex++] : undefined;
          return (
            <li key={index} data-state={drawn.state}>
              <button
                type="button"
                aria-expanded={open === index}
                aria-label={t('skillTest.changeToken', { token: name(shown) })}
                onClick={() => setOpen(open === index ? undefined : index)}
              >
                <ChaosTokenFace token={shown} />
              </button>
              {drawn.state !== 'resolved' && (
                <>
                  {' '}
                  <span>{t(`skillTest.tokenState.${drawn.state}`)}</span>
                </>
              )}
              {drawn.treatedAs !== undefined && (
                <>
                  {' '}
                  <span>{t('skillTest.treatedFrom', { token: name(drawn.token) })}</span>
                </>
              )}
              {drawn.state === 'resolved' && hasSymbol(shown) && shown !== 'autoFail' && (
                <>
                  {' '}
                  <data value={effect ?? ''}>{signedOrUnknown(effect)}</data>
                </>
              )}
            </li>
          );
        })}
      </ol>
      {open !== undefined && chosen !== undefined && (
        <div
          role="group"
          aria-label={t('skillTest.tokenActions', {
            token: name(chosen.treatedAs ?? chosen.token),
          })}
        >
          {chosen.state === 'resolved' ? (
            <>
              <button type="button" onClick={() => act(open, { kind: 'cancel' })}>
                {t('skillTest.tokenAction.cancel')}
              </button>
              <button type="button" onClick={() => act(open, { kind: 'ignore' })}>
                {t('skillTest.tokenAction.ignore')}
              </button>
            </>
          ) : (
            <button type="button" onClick={() => act(open, { kind: 'resolve' })}>
              {t('skillTest.tokenAction.resolve')}
            </button>
          )}
          <button type="button" onClick={() => act(open, { kind: 'redraw' })}>
            {t('skillTest.tokenAction.redraw')}
          </button>
          {run.treatOptions
            .filter((token) => token !== chosen.token && token !== chosen.treatedAs)
            .map((token) => (
              <button
                key={token}
                type="button"
                aria-label={t('skillTest.treatAs', { token: name(token) })}
                onClick={() => act(open, { kind: 'treatAs', as: token })}
              >
                <ChaosTokenFace token={token} />
              </button>
            ))}
          {chosen.treatedAs !== undefined && (
            <button type="button" onClick={() => act(open, { kind: 'treatAs' })}>
              {t('skillTest.treatAsItself', { token: name(chosen.token) })}
            </button>
          )}
        </div>
      )}
      {run.revealAnother && (
        <button type="button" aria-controls={listId} onClick={run.revealAnother}>
          {t('skillTest.revealOneMore')}
        </button>
      )}
    </>
  );
}

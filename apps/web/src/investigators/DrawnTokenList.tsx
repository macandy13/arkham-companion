import { useCallback, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChaosToken, DrawnToken } from '@arkham/engine';
import { PaperBubble } from '../screens/PaperBubble';
import { ChaosTokenFace } from '../tokens/ChaosTokenFace';
import { hasSymbol, signedOrUnknown } from '../tokens/tokenValue';
import type { DrawnTokenAction } from './drawn_token_action';
import type { SkillTestRun } from './TestCalculation';

/**
 * The tokens drawn for a skill test, in the order they came out, side by side (ME.24b). Each shows
 * as the token it counts as, with the effect of its symbol under it while it resolves, and fades
 * once a card set it aside. Tapping one opens what a card can do to it in a bubble
 * (`DrawnTokenBubble`). Once the draw is done, a + reveals one more as a card says.
 * `effects` are the modifiers of the resolved tokens in order (`undefined` where a card decides).
 */
export function DrawnTokenList({
  run,
  effects,
}: {
  run: Pick<SkillTestRun, 'drawn' | 'act' | 'revealAnother' | 'replaceOptions'>;
  effects: readonly (number | undefined)[];
}) {
  const { t } = useTranslation();
  const listId = useId();
  const [open, setOpen] = useState<{ index: number; anchor: Element }>();
  const close = useCallback(() => setOpen(undefined), []);
  let resolvedIndex = 0;
  const chosen = open && run.drawn[open.index];
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
                aria-expanded={open?.index === index}
                aria-label={t('skillTest.changeToken', { token: t(`chaosToken.${shown}`) })}
                onClick={(event) =>
                  setOpen(
                    open?.index === index ? undefined : { index, anchor: event.currentTarget },
                  )
                }
              >
                <ChaosTokenFace token={shown} />
              </button>
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
      {run.revealAnother && (
        <button
          type="button"
          aria-label={t('skillTest.revealOneMore')}
          aria-controls={listId}
          onClick={run.revealAnother}
        >
          +
        </button>
      )}
      {open && chosen && (
        <DrawnTokenBubble
          key={open.index}
          drawn={chosen}
          anchor={open.anchor}
          replaceOptions={run.replaceOptions(open.index)}
          onAct={(action) => {
            close();
            run.act(open.index, action);
          }}
          onClose={close}
        />
      )}
    </>
  );
}

/**
 * What a card can do to one drawn token (`drawn`), on a bubble over it (`anchor`): ignore it, or
 * resolve it again once ignored; redraw it; or replace it, which then offers the kinds still in
 * the bag (`replaceOptions`) to swap it for.
 */
function DrawnTokenBubble({
  drawn,
  anchor,
  replaceOptions,
  onAct,
  onClose,
}: {
  drawn: DrawnToken;
  anchor: Element;
  replaceOptions: readonly ChaosToken[];
  onAct: (action: DrawnTokenAction) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [replacing, setReplacing] = useState(false);
  const shown = drawn.treatedAs ?? drawn.token;
  const replacements = replaceOptions.filter((token) => token !== drawn.token);
  return (
    <PaperBubble anchor={anchor} title={t(`chaosToken.${shown}`)} kind="token" onClose={onClose}>
      {replacing ? (
        <section aria-label={t('skillTest.tokenAction.replace')}>
          {replacements.map((token) => (
            <button
              key={token}
              type="button"
              aria-label={t('skillTest.replaceWith', { token: t(`chaosToken.${token}`) })}
              onClick={() => onAct({ kind: 'replace', token })}
            >
              <ChaosTokenFace token={token} />
            </button>
          ))}
        </section>
      ) : (
        <section aria-label={t('skillTest.tokenActions', { token: t(`chaosToken.${shown}`) })}>
          {drawn.state === 'resolved' ? (
            <button type="button" onClick={() => onAct({ kind: 'ignore' })}>
              {t('skillTest.tokenAction.ignore')}
            </button>
          ) : (
            <button type="button" onClick={() => onAct({ kind: 'resolve' })}>
              {t('skillTest.tokenAction.resolve')}
            </button>
          )}
          <button type="button" onClick={() => onAct({ kind: 'redraw' })}>
            {t('skillTest.tokenAction.redraw')}
          </button>
          <button
            type="button"
            disabled={replacements.length === 0}
            onClick={() => setReplacing(true)}
          >
            {t('skillTest.tokenAction.replace')}
          </button>
        </section>
      )}
    </PaperBubble>
  );
}

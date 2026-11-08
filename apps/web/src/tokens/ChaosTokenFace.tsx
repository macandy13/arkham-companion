import type { ChaosToken } from '@arkham/engine';
import { useTranslation } from 'react-i18next';
import './chaos_tokens.css';

/**
 * A chaos token as it lies on the table (MD.8c), in the player's token set (`TokenSet`): the
 * cardboard set's black disc with an ivory rim, or the resin set's dome in a colour per symbol, its
 * numbers in a star frame. A number token writes its number, a symbol token draws the game's
 * symbol, its name kept for screen readers only (`chaos_tokens.css`). The faces are our own
 * drawings, from `design/design_language/tokens/gen_chaos_files.py` in the project library. Used
 * wherever a chaos token shows: the skill test's drawn tokens, the chaos bag and the campaign log.
 * The stylesheet where it is used sets its size (`--chaos-token-size`).
 */
export function ChaosTokenFace({ token }: { token: ChaosToken }) {
  const { t } = useTranslation();
  return <span data-chaos-face={token}>{t(`chaosToken.${token}`)}</span>;
}

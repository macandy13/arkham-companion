import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/** The symbols card text names in brackets (`[combat]`) that the cards draw as icons. */
const SYMBOLS = [
  'willpower',
  'intellect',
  'combat',
  'agility',
  'wild',
  'per_investigator',
] as const;

/** A symbol card text can name that the cards draw as an icon. */
type CardSymbol = (typeof SYMBOLS)[number];

function isCardSymbol(name: string): name is CardSymbol {
  return (SYMBOLS as readonly string[]).includes(name);
}

/**
 * Card text in ArkhamDB markup as running text: the traits it names in double brackets
 * (`[[Ghoul]]`) emphasised, as the printed cards set them in bold italics, and the symbols it names
 * in brackets drawn as icons (`data-symbol`), each named by its skill for assistive technology;
 * brackets it has no icon for stay as text.
 */
export function cardText(text: string): ReactNode[] {
  return text.split(/(\[\[[^\]]+\]\]|\[[a-z_]+\])/).map((part, index) => {
    const trait = /^\[\[([^\]]+)\]\]$/.exec(part)?.[1];
    if (trait !== undefined) return <em key={index}>{trait}</em>;
    const symbol = /^\[([a-z_]+)\]$/.exec(part)?.[1];
    return symbol !== undefined && isCardSymbol(symbol) ? (
      <SymbolIcon key={index} symbol={symbol} />
    ) : (
      part
    );
  });
}

/** A game symbol in running text, named by its skill. */
function SymbolIcon({ symbol }: { symbol: CardSymbol }) {
  const { t } = useTranslation();
  return <span role="img" aria-label={t(`symbol.${symbol}`)} data-symbol={symbol} />;
}

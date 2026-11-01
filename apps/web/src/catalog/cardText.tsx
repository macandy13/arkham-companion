import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import './card_text.css';

/** The symbols card text names in brackets (`[combat]`) that the cards draw as icons. */
const SYMBOLS = [
  'willpower',
  'intellect',
  'combat',
  'agility',
  'wild',
  'per_investigator',
  'action',
  'free',
  'reaction',
  'elder_sign',
  'skull',
  'auto_fail',
  'bless',
  'curse',
] as const;

/**
 * Symbols ArkhamDB names differently from the game's own symbol files: `[fast]` marks a free
 * triggered ability, which the cards print as the free-ability symbol.
 */
const ALIASES: Readonly<Record<string, CardSymbol>> = { fast: 'free' };

/** A symbol card text can name that the cards draw as an icon. */
type CardSymbol = (typeof SYMBOLS)[number];

function symbolOf(name: string): CardSymbol | undefined {
  const alias = Object.hasOwn(ALIASES, name) ? ALIASES[name] : undefined;
  return alias ?? SYMBOLS.find((symbol) => symbol === name);
}

/**
 * Card text in ArkhamDB markup as running text: the traits it names in double brackets
 * (`[[Ghoul]]`) and the runs it sets bold or italic (`<b>Forced</b>`) emphasised, as the printed
 * cards set them in bold italics, and the symbols it names in brackets drawn as icons
 * (`data-symbol`), each named for assistive technology; brackets it has no icon for stay as text,
 * and other tags (`<u>`) are dropped.
 */
export function cardText(text: string): ReactNode[] {
  return text.split(/(\[\[[^\]]+\]\]|\[[a-z_]+\]|<b>.*?<\/b>|<i>.*?<\/i>)/).map((part, index) => {
    const trait = /^\[\[([^\]]+)\]\]$/.exec(part)?.[1];
    if (trait !== undefined) return <em key={index}>{trait}</em>;
    // A bold or italic run may name traits and symbols of its own.
    const run = /^<([bi])>(.*)<\/\1>$/.exec(part)?.[2];
    if (run !== undefined) return <em key={index}>{cardText(run)}</em>;
    const symbol = symbolOf(/^\[([a-z_]+)\]$/.exec(part)?.[1] ?? '');
    return symbol ? <SymbolIcon key={index} symbol={symbol} /> : withoutTags(part);
  });
}

/** Text without the markup tags this screen does not draw (`<u>`, a stray `</i>`). */
function withoutTags(text: string): string {
  return text.replace(/<\/?[a-z]+>/g, '');
}

/**
 * Card text of several lines (ArkhamDB puts each ability on its own) as one paragraph each, in
 * the markup `cardText` reads.
 */
export function cardParagraphs(text: string): ReactNode[] {
  return text
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line, index) => <p key={index}>{cardText(line)}</p>);
}

/** A game symbol in running text, named by its skill. */
function SymbolIcon({ symbol }: { symbol: CardSymbol }) {
  const { t } = useTranslation();
  return <span role="img" aria-label={t(`symbol.${symbol}`)} data-symbol={symbol} />;
}

import { cardCode, type CardDb, type CardStats } from '../../src/index';

/** The card with `code` in `db`, failing the test if the data has none. */
export function cardIn(db: CardDb, code: string): CardStats {
  const card = db.get(cardCode(code));
  if (!card) throw new Error(`no card ${code}`);
  return card;
}

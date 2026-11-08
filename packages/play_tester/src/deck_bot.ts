import {
  byName,
  type CardName,
  type Decision,
  type InstanceId,
  type PlayTable,
  type SkillName,
} from '@arkham/engine';
import { botStep } from './bots';
import { deckFor, type PlayerCard } from './player_cards';
import type { Run, SeededRandom } from './run';
import type { CardEffect, Step } from './steps';
import { drawnResult, openDrawnTest } from './test_answers';

/** The cards an investigator plays or commits in one turn at most (player-card-analysis.md). */
const PLAYS_PER_TURN = 3;

/** Cards in the opening hand, and the most a hand holds after an upkeep draw. */
const OPENING_HAND = 5;
const HAND_LIMIT = 8;

/** The skill cards committed to one test at most, so a hand isn't spent on one draw. */
const COMMITS_PER_TEST = 2;

/** A card in an investigator's play area, with the uses and soak it has left. */
interface InPlay {
  readonly card: PlayerCard;
  uses: number;
  exhausted: boolean;
  health: number;
  sanity: number;
}

/** What the deck bot knows of one investigator's player cards; the table never sees them. */
interface Seat {
  readonly deck: PlayerCard[];
  readonly hand: PlayerCard[];
  readonly inPlay: InPlay[];
  /** Damage and horror when the bot last looked, so it sees what an attack dealt. */
  damage: number;
  horror: number;
}

/**
 * The deck bot (player-card-analysis.md, "The deck bot"): the goal bot's game with a hand of
 * player cards for each investigator. It answers its own skill tests with committed skill cards,
 * weapons and boosts as the players' modifier; plays assets and events from the hand, up to
 * `PLAYS_PER_TURN` a turn, each as a `playerCard` step of table commands after the `playCard`
 * action; heals what its allies and accessories soak; and leaves every other step to the goal
 * bot. Its cards are its own state, so a run's steps replay without it.
 */
export class DeckBot {
  private readonly seats = new Map<CardName, Seat>();
  private readonly queue: Step[] = [];
  private round = 0;
  private turn: { investigator?: CardName; plays: number } = { plays: 0 };

  /** A bot for the investigators named in `decks`, each drawing an opening hand off the top of their deck. */
  constructor(decks: ReadonlyMap<CardName, readonly PlayerCard[]>) {
    for (const [name, cards] of decks) {
      const deck = [...cards];
      this.seats.set(name, {
        deck,
        hand: deck.splice(0, OPENING_HAND),
        inPlay: [],
        damage: 0,
        horror: 0,
      });
    }
  }

  /** The bot for `run`, with a shuffled deck for each of its investigators (`deckFor`). */
  static forRun(run: Run, random: SeededRandom): DeckBot {
    return new DeckBot(new Map(run.seats.map((name) => [name, deckFor(name, random)])));
  }

  /**
   * The next step on `table`: a queued one, a card's, or the goal bot's. Card effects wait while a
   * decision is open (an attack of opportunity on the play action, a test), as the table takes no
   * other command then; the goal bot and the bot's own test answers settle it first.
   */
  step(table: PlayTable, random: SeededRandom): Step {
    this.keepUp(table);
    const open = table.state.pending.length > 0;
    if (!open && this.queue.length > 0) return this.queue.shift()!;
    const steps =
      (open ? undefined : this.soaked(table)) ??
      this.answeredTest(table, random) ??
      this.playedCard(table, random);
    if (steps) {
      this.queue.push(...steps.slice(1));
      return steps[0]!;
    }
    return botStep('goal', table, random);
  }

  /** A new round draws a card for each investigator and readies their cards; a new turn counts plays from 0. */
  private keepUp(table: PlayTable): void {
    const { board } = table;
    if (board.round !== this.round) {
      if (this.round > 0)
        for (const seat of this.seats.values()) {
          const drawn = seat.deck.shift();
          if (drawn && seat.hand.length < HAND_LIMIT) seat.hand.push(drawn);
          for (const card of seat.inPlay) card.exhausted = false;
        }
      this.round = board.round;
    }
    const turn = board.turn === undefined ? undefined : board.investigator(board.turn).name;
    if (turn !== this.turn.investigator)
      this.turn = { ...(turn && { investigator: turn }), plays: 0 };
  }

  /**
   * Healing for the damage or horror an investigator took since the bot last looked, as far as an
   * ally or accessory in play could have soaked it (player-card-analysis.md: soaking is played as
   * healing right after).
   */
  private soaked(table: PlayTable): Step[] | undefined {
    for (const [name, seat] of this.seats) {
      const view = table.board.investigator(byName(name));
      if (view.status !== 'active') continue;
      const tookDamage = view.damage - seat.damage;
      const tookHorror = view.horror - seat.horror;
      seat.damage = view.damage;
      seat.horror = view.horror;
      for (const soaker of seat.inPlay) {
        const damage = Math.min(Math.max(tookDamage, 0), soaker.health);
        const horror = Math.min(Math.max(tookHorror, 0), soaker.sanity);
        if (damage + horror === 0) continue;
        soaker.health -= damage;
        soaker.sanity -= horror;
        seat.damage -= damage;
        seat.horror -= horror;
        const effects: CardEffect[] = [
          ...(damage > 0 ? [{ kind: 'heal', stat: 'damage', amount: damage } as const] : []),
          ...(horror > 0 ? [{ kind: 'heal', stat: 'horror', amount: horror } as const] : []),
        ];
        return [{ verb: 'playerCard', investigator: name, card: soaker.card.name, effects }];
      }
    }
    return undefined;
  }

  /**
   * The answer to an open skill test of one of the bot's investigators: skill cards with the
   * tested icon committed (while the turn has plays left), the best weapon on a fight, a boost
   * paid with resources, Lucky! when it turns a near fail into a pass, then the result with the
   * damage or clues a pass confirms. Spent resources and played events come as steps before it.
   */
  private answeredTest(table: PlayTable, random: SeededRandom): Step[] | undefined {
    const decision = openDrawnTest(table);
    if (!decision?.skillTest || decision.decider.kind !== 'investigator') return undefined;
    const investigator = table.board.investigator(decision.decider.investigatorId);
    const seat = this.seats.get(investigator.name);
    if (!seat) return undefined;
    const { skill } = decision.skillTest;
    const kind = decision.testKind?.kind;
    const used: CardName[] = [];
    const before: Step[] = [];
    let modifier = 0;
    let extra = 0;
    const committed = this.commits(seat, skill, kind === 'investigate' || kind === 'fight');
    for (const card of committed) {
      modifier += (card.icons[skill] ?? 0) + (card.icons.wild ?? 0);
      used.push(card.name);
    }
    const weapon = kind === 'fight' ? bestWeapon(seat) : undefined;
    if (weapon && weapon.card.use.kind === 'weapon') {
      const instead = weapon.card.use.skill;
      // A weapon that fights with another skill (Shrivelling) is played as the difference.
      modifier +=
        weapon.card.use.bonus +
        (instead ? investigator.skills[instead] - investigator.skills[skill] : 0);
      extra += weapon.card.use.damage;
      if (weapon.card.use.uses !== undefined) weapon.uses--;
      used.push(weapon.card.name);
    }
    for (const boost of seat.inPlay) {
      const { use } = boost.card;
      if (
        use.kind === 'freeBoost' &&
        kind === 'investigate' &&
        use.skill === skill &&
        boost.uses > 0
      ) {
        modifier += use.bonus;
        if (use.uses !== undefined) boost.uses--;
        used.push(boost.card.name);
      }
    }
    const paid = seat.inPlay.find(
      ({ card }) => card.use.kind === 'paidBoost' && card.use.skills.includes(skill),
    );
    const spend = paid ? Math.min(2, investigator.resources) : 0;
    if (paid && spend > 0) {
      modifier += spend;
      before.push(spending(investigator.name, paid.card.name, spend));
    }
    let drawn = drawnResult(table, decision, random, modifier);
    if (!drawn) return undefined;
    const lucky = seat.hand.find(({ use }) => use.kind === 'lucky');
    if (
      lucky?.use.kind === 'lucky' &&
      drawn.result !== 'pass' &&
      drawn.margin <= lucky.use.bonus &&
      investigator.resources - spend >= (lucky.cost ?? 0)
    ) {
      seat.hand.splice(seat.hand.indexOf(lucky), 1);
      before.push(spending(investigator.name, lucky.name, lucky.cost ?? 0));
      drawn = { ...drawn, result: 'pass' };
    }
    for (const card of committed) {
      if (drawn.result !== 'pass') continue;
      if (card.use.kind === 'commit' && card.use.adds === 'damage' && kind === 'fight') extra++;
      if (card.use.kind === 'commit' && card.use.adds === 'clue' && kind === 'investigate') extra++;
    }
    const after: Step[] = committed
      .filter(({ use }) => drawn.result === 'pass' && use.kind === 'commit' && use.adds === 'heal')
      .map((card) => ({
        verb: 'playerCard',
        investigator: investigator.name,
        card: card.name,
        effects: [{ kind: 'heal', stat: 'horror', amount: 1 }],
      }));
    // The table takes no other command while the test is open, so what was spent on it comes after.
    return [
      {
        verb: 'resolveTest',
        investigator: investigator.name,
        tokens: drawn.tokens,
        result: drawn.result,
        ...(drawn.result === 'pass' && extra > 0 && passAmount(decision, extra)),
        ...(used.length > 0 && { cards: used }),
      },
      ...before,
      ...after,
    ];
  }

  /**
   * Skill cards from `seat`'s hand with `skill` or wild icons, while the turn has plays left; they
   * leave the hand. A test that advances the act (`forAct`: an investigation or a fight) gets up to
   * `COMMITS_PER_TEST`, any other test one, so the hand is kept for the clues.
   */
  private commits(seat: Seat, skill: SkillName, forAct: boolean): PlayerCard[] {
    const room = Math.min(forAct ? COMMITS_PER_TEST : 1, PLAYS_PER_TURN - this.turn.plays);
    const committed = seat.hand
      .filter(({ type, icons }) => type === 'skill' && (icons[skill] ?? 0) + (icons.wild ?? 0) > 0)
      .slice(0, Math.max(room, 0));
    for (const card of committed) seat.hand.splice(seat.hand.indexOf(card), 1);
    this.turn.plays += committed.length;
    return committed;
  }

  /**
   * The card the investigator whose turn it is plays from the hand or uses in play, while no
   * decision is open and the turn has plays left: the one that gets the act advanced fastest
   * (`actScore`), ties in a random order. A card worth less than `WORTH_PLAYING` is kept, so its
   * action goes to investigating instead.
   */
  private playedCard(table: PlayTable, random: SeededRandom): Step[] | undefined {
    const name = this.turn.investigator;
    const seat = name && this.seats.get(name);
    if (!name || !seat || table.state.pending.length > 0) return undefined;
    const plays = [
      ...seat.hand.map((card) => this.fromHand(table, name, seat, card)),
      ...seat.inPlay.map((card) => this.inPlay(table, name, card, random)),
    ].filter((play): play is Play => play !== undefined && play.score >= WORTH_PLAYING);
    const [best] = random.shuffle(plays).sort((a, b) => b.score - a.score);
    if (!best) return undefined;
    best.commit();
    return best.steps;
  }

  /** Playing `card` from `seat`'s hand now, if it fits the board and the purse. */
  private fromHand(
    table: PlayTable,
    name: CardName,
    seat: Seat,
    card: PlayerCard,
  ): Play | undefined {
    const { board } = table;
    const view = board.investigator(byName(name));
    const cost = card.cost ?? 0;
    if (card.type === 'skill' || this.turn.plays >= PLAYS_PER_TURN || view.resources < cost)
      return undefined;
    if (!card.fast && view.actions < 1) return undefined;
    const location = view.at === undefined ? undefined : board.location(byName(view.at));
    const engaged = board.enemiesEngagedWith(view.id);
    const here = location ? board.enemiesAt(location.id) : [];
    const situation: Situation = {
      clues: location?.clues ?? 0,
      engaged: engaged[0]?.id,
      here: here[0]?.id,
      exit: exitOf(table, location?.id),
      resources: view.resources - cost,
      nearDefeat: view.damage >= view.health - 2 || view.horror >= view.sanity - 2,
    };
    const effects = this.playEffects(card, situation);
    if (!effects) return undefined;
    const played: Step = {
      verb: 'playerCard',
      investigator: name,
      card: card.name,
      effects: [...(cost > 0 ? [{ kind: 'resources', delta: -cost } as const] : []), ...effects],
    };
    return {
      score: actScore(card, situation),
      steps: card.fast ? [played] : [{ verb: 'playCard', investigator: name }, played],
      commit: () => {
        seat.hand.splice(seat.hand.indexOf(card), 1);
        if (card.type === 'asset')
          seat.inPlay.push({
            card,
            uses: 'uses' in card.use && typeof card.use.uses === 'number' ? card.use.uses : 1,
            exhausted: false,
            health: card.soak?.health ?? 0,
            sanity: card.soak?.sanity ?? 0,
          });
        this.turn.plays++;
      },
    };
  }

  /** What playing `card` does on this board, or `undefined` when it does nothing useful now. */
  private playEffects(card: PlayerCard, board: Situation): CardEffect[] | undefined {
    const { use } = card;
    switch (use.kind) {
      case 'lasting':
        return [{ kind: 'skillBoost', skill: use.skill, delta: 1 }];
      case 'extraAction':
        return [{ kind: 'actions', delta: 1 }];
      case 'none':
        if (card.type !== 'asset' || !card.soak) return undefined;
        return use.doom ? [{ kind: 'doomOnPlayerCards', delta: use.doom }] : [];
      case 'weapon':
      case 'paidBoost':
      case 'freeBoost':
      case 'heal':
        return card.type === 'asset' ? [] : undefined;
      case 'resources':
        return card.type === 'asset' ? [] : [{ kind: 'resources', delta: use.amount }];
      case 'clues':
        if (board.clues === 0) return undefined;
        return [
          ...(use.drawsEncounterCard ? [{ kind: 'drawEncounterCard' } as const] : []),
          { kind: 'discoverClues', amount: Math.min(use.amount, board.clues) },
        ];
      case 'damage':
        if (!board.here) return undefined;
        return [
          { kind: 'damageEnemy', enemy: board.here, amount: use.amount },
          ...(use.hurtsSelf ? [{ kind: 'hurt', damage: use.hurtsSelf, horror: 0 } as const] : []),
        ];
      case 'evade':
        if (!board.engaged) return undefined;
        return [
          { kind: 'evadeEnemy', enemy: board.engaged },
          ...(use.damage
            ? [{ kind: 'damageEnemy', enemy: board.engaged, amount: use.damage } as const]
            : []),
        ];
      case 'escape':
        if (!board.engaged || !board.exit) return undefined;
        return [
          { kind: 'disengage', enemy: board.engaged },
          { kind: 'moveTo', location: board.exit },
        ];
      case 'lucky':
      case 'commit':
        return undefined;
    }
  }

  /** Using `card` in play now: healing, resources. */
  private inPlay(
    table: PlayTable,
    name: CardName,
    card: InPlay,
    random: SeededRandom,
  ): Play | undefined {
    const view = table.board.investigator(byName(name));
    const { use } = card.card;
    if (card.exhausted || card.uses < 1) return undefined;
    const nearDefeat = view.damage >= view.health - 2 || view.horror >= view.sanity - 2;
    if (use.kind === 'heal' && view.actions > 0 && (view.damage > 0 || view.horror > 0)) {
      const stat = view.damage > 0 ? 'damage' : 'horror';
      let effect: CardEffect = { kind: 'heal', stat, amount: 1 };
      if (use.uses === 'test') {
        // Medical Texts' intellect test, played as even odds: a fail deals the damage instead.
        if (view.damage === 0) return undefined;
        if (random.below(2) === 0) effect = { kind: 'hurt', damage: 1, horror: 0 };
      }
      return {
        score: nearDefeat ? 9 : 1,
        steps: [
          { verb: 'spendAction', investigator: name },
          { verb: 'playerCard', investigator: name, card: card.card.name, effects: [effect] },
        ],
        commit: () => {
          if (use.uses !== 'test') card.uses--;
        },
      };
    }
    if (use.kind === 'resources' && (!use.exhausts || view.actions > 0)) {
      const effects: CardEffect[] = [
        { kind: 'resources', delta: use.amount },
        ...(use.horror ? [{ kind: 'hurt', damage: 0, horror: use.horror } as const] : []),
      ];
      const played: Step = {
        verb: 'playerCard',
        investigator: name,
        card: card.card.name,
        effects,
      };
      return {
        score: view.resources < 3 && !(use.horror && nearDefeat) ? 7 : 1,
        steps: use.exhausts ? [{ verb: 'spendAction', investigator: name }, played] : [played],
        commit: () => {
          if (use.uses !== undefined) card.uses--;
          card.exhausted = true;
        },
      };
    }
    return undefined;
  }
}

/** A card the bot could play now, how much it helps, and what playing it changes in the bot's own state. */
interface Play {
  readonly score: number;
  readonly steps: Step[];
  readonly commit: () => void;
}

/** What the investigator playing a card has around them. */
interface Situation {
  readonly clues: number;
  readonly engaged?: InstanceId;
  readonly here?: InstanceId;
  readonly exit?: CardName;
  /** Resources left after paying for the card. */
  readonly resources: number;
  readonly nearDefeat: boolean;
}

/** The least `actScore` a card is played for. */
const WORTH_PLAYING = 3;

/**
 * How much playing `card` now gets the act advanced (Andy's aim for the bot: advance the act as
 * fast as the cards allow): clues first, then what finds clues faster, then what pays for it,
 * then clearing the enemies in the way, then staying in the game. Doom on a player card brings
 * the agenda closer, so the bot never plays it.
 */
function actScore(card: PlayerCard, situation: Situation): number {
  const { use } = card;
  const clues = situation.clues > 0;
  switch (use.kind) {
    case 'clues':
      return 10 + use.amount;
    case 'freeBoost':
      return use.skill === 'intellect' && clues ? 8 : 4;
    case 'lasting':
      return use.skill === 'intellect' ? 8 : 4;
    case 'paidBoost':
      return use.skills.includes('intellect') ? 6 : 4;
    case 'extraAction':
      return 8;
    case 'resources':
      return situation.resources < 3 ? 7 : 2;
    case 'damage':
    case 'evade':
    case 'escape':
      return 7;
    case 'weapon':
      return situation.engaged ? 6 : 3;
    case 'heal':
      return situation.nearDefeat ? 5 : 3;
    case 'none':
      return use.doom ? 0 : 3;
    case 'lucky':
    case 'commit':
      return 0;
  }
}

/** The weapon in `seat`'s play area with the best bonus and uses left. */
function bestWeapon(seat: Seat): InPlay | undefined {
  return seat.inPlay
    .filter(({ card, uses }) => card.use.kind === 'weapon' && uses > 0)
    .sort((a, b) => weaponBonus(b) - weaponBonus(a))[0];
}

function weaponBonus({ card }: InPlay): number {
  return card.use.kind === 'weapon' ? card.use.bonus + card.use.damage : 0;
}

/** The step of spending `amount` resources for `card`. */
function spending(investigator: CardName, card: CardName, amount: number): Step {
  return {
    verb: 'playerCard',
    investigator,
    card,
    effects: [{ kind: 'resources', delta: -amount }],
  };
}

/**
 * The count a pass of `decision` confirms with `extra` more than its default (the damage of a
 * fight, the clues of an investigation), within the range the table offers; nothing when the pass
 * has no adjustable count (an investigation where no clues are left).
 */
function passAmount(decision: Decision, extra: number): { amount?: number } {
  const range = decision.options.find(({ id }) => id === 'pass')?.amount;
  if (!range) return {};
  return { amount: Math.min(range.default + extra, range.max ?? Infinity) };
}

/** A revealed location connected to `location`, by name, to escape to. */
function exitOf(table: PlayTable, location: InstanceId | undefined): CardName | undefined {
  if (location === undefined) return undefined;
  const exit = table.board.connectedTo(location).find((id) => table.board.location(id).revealed);
  return exit && table.board.location(exit).name;
}

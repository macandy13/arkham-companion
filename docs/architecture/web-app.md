# Web app

The React PWA is a thin layer over the engine.
[`App.tsx`](../../apps/web/src/App.tsx) defines the hash routes; screens are in [`screens/`](../../apps/web/src/screens/):

- home, with the campaigns (each opens its campaign log) above the saved games,
- new game wizard, whose campaign path starts a campaign log and its first scenario as one of its games (`AppState.startCampaign`),
- campaign log (`/campaign/:id`, [`campaign/`](../../apps/web/src/campaign/)),
- game screen,
- settings with the owned packs of the campaigns the app plays (`CampaignEntry.packCodes`) and the unofficial fan project notice.

Components read the [app store](../../apps/web/src/state/appStore.ts) and call its methods; they never change game state or touch storage.

## Investigator picker

The new game wizard's [investigator picker](../../apps/web/src/picker/InvestigatorPicker.tsx) shows the catalog's investigators alphabetically in pages of ten ([`PortraitPages.tsx`](../../apps/web/src/picker/PortraitPages.tsx)):

- one list, laid out by the stylesheet in two rows of five per page (the first five of every ten in the top row), which scrolls sideways and snaps a page at a time;
- each portrait is the figure cut from the picture of the card's front (`--picker-portrait-*` in tokens.css) over the name, the class in its colour (`--color-class-*`) and the skills, health and sanity as icons with values.

Its filters sit behind one round button that opens a menu, drawn like the play screen's ☰ menu (`button[data-icon][aria-expanded] + *` in base.css), and the button counts the filters set.
A tap on a portrait opens the detail sheet as a dialog.

## Campaign log

The [campaign screen](../../apps/web/src/campaign/CampaignScreen.tsx) draws the open campaign (`AppState.openCampaign`, `OpenCampaign`: the replayed `CampaignLog` and the campaign's games) like the Core Set's campaign log sheet (docs/product.md "Campaign screen"):

- an index card with the printed fields in a column per investigator (unspent XP, trauma as tally marks ([`Tally.tsx`](../../apps/web/src/campaign/Tally.tsx)), earned story cards by name from the catalog), and a napkin with the campaign's scenarios, the played ones ticked with their resolution and the next one marked `aria-current`;
- a link that continues the game of the scenario in play.

The paper look is tokens, so dialogs can share it: fonts `--font-family-print`, `-log-label`, `-script`, `-hand`; inks `--color-print`, `-pen`, `-script-ink`, `-stamp`; papers `--index-card-paper`, `--napkin-paper`; the torn outline `--paper-edge` (a `clip-path` polygon on a layer behind the sheet, so the writing stays crisp).
[`campaign_log.css`](../../apps/web/src/campaign/campaign_log.css) selects by the sheets' ids, and drops the panel frame the other screens have.

## Open game

The open game (`OpenGame`) is the play screen's single source of truth:

- **`GameActions`** ([`gameActions.ts`](../../apps/web/src/state/gameActions.ts)) are the players' verbs (`moveTo`, `investigate`, `answer('pass')`). They act for the investigator whose turn it is and answer the first pending decision, so they take no ids.
  - Investigate, engage, take a resource, draw and play (`takeResource`, `drawCard`, `playCard`: the engine's commands taken `asAction`), and move, fight and evade unless `free`, also count off one of that investigator's actions, which the engine leaves to the players (the pawn's drag is a free move, as it also catches up with a move made at the table; a free move provokes no attacks of opportunity), and leave a skill test open for the decision dialog;
  - buttons are disabled while `OpenGame.busy`.
- **`GameSession`** ([`gameSession.ts`](../../apps/web/src/state/gameSession.ts)) holds a `PlayTable` resumed from the stored log, plays each action as one undo group, writes it, then publishes the state.
  - A refused step stores nothing and shows its `Rejection` as a toast; a failed write reloads the stored game.
  - Steps run strictly in order.
  - `undoTo(step)` goes back to right after a step of the game log by taking back each later undo group in turn, so storage and memory step back exactly as with Undo.
  - While the players adjust the board (`startAdjusting`, `OpenGame.adjusting`), steps change the table in memory only; "Done" (`finishAdjusting`) plays them again from where the adjustment started as one stored step, so one undo takes the whole correction back, and "Cancel" resumes the table from that point.
  - The screen shows the steppers and the location details' corrections only while adjusting (`data-adjusting` on the board) and holds back the steps of play (turn controls, the act's advance, piece drags) meanwhile.
- **`BoardView`** (`OpenGame.board`) is what the screen reads: names, thresholds and derived values, never raw state.
  The encounter piles come from `BoardView.encounter` (the deck's count, the discard pile top first, the set-aside cards and the victory display, each card with its id, code, name, type, picture and victory points), so the screen never reads zones.

The play screen is described in [Play screen](play-screen.md) and its pages.

## Extension points

- **A new game action:** add it to `GameActions` as one `PlayTable` verb (add the verb to `PlayTable` first). Only actions outside the open game get their own `AppState` method.
- **A new screen:** a route in `App.tsx`, a component in `screens/`, an E2E flow tagged `@flow` or a screenshot tagged `@shot`, strings in English and German.
- **A new refusal or skippable effect:** its `rejections.<code>` or `skipped.effects.<type>` string in English and German.
- **A new decision prompt or option label:** its string under the engine's key (`decision.<key>`, or the scenario's `scenario.<scenario>.<card>.<key>`) in English and German.

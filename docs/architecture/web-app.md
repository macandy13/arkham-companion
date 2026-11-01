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

- an index card with the printed fields in a column per investigator and blank columns up to the printed four, all on shared subgrid rows so labels sit level (unspent XP, trauma as tally marks ([`Tally.tsx`](../../apps/web/src/campaign/Tally.tsx)), earned story cards by name from the catalog), and a napkin with the campaign's scenarios, the played ones ticked with their resolution and the next one marked `aria-current`;
- notepad pages ([`CampaignSheets.tsx`](../../apps/web/src/campaign/CampaignSheets.tsx)) with the campaign notes and the campaign's own sheets from its `CampaignLogLayout`, each record in words from `CampaignEntry.storyKey` (a flag's note at `<storyKey>.<record>.yes` or `.no`, a list's heading at `<storyKey>.<record>`), crossed-out names in `<del>`;
- the sheets every campaign shares after them: a newspaper clipping with the killed and insane investigators (replaced ones first) and an index card with the chaos bag, each kind of token once with its count, in `CHAOS_TOKENS` order;
- a link that continues the game of the scenario in play.

The paper look is tokens, so dialogs can share it: fonts `--font-family-print`, `-log-label`, `-script`, `-hand`; inks `--color-print`, `-pen`, `-script-ink`, `-stamp`, `--color-newsprint-ink`; papers `--index-card-paper`, `--napkin-paper`, `--clipping-paper`, `--notepad-paper` (ruled `--notepad-line` apart), tilts `--sheet-tilt`, `--clipping-tilt`; the torn outline `--paper-edge` (a `clip-path` polygon on a layer behind the sheet, so the writing stays crisp).
[`campaign_log.css`](../../apps/web/src/campaign/campaign_log.css) selects by the sheets' ids, and `base.css` leaves it off the paper the other screens are printed on.

When a game ends, `OpenGame.resolution` (`PendingResolution`) holds the resolution it reached and, for each of its scenario's resolutions and "no resolution", what `campaign.proposeResolution` proposes (`ResolutionOption`), read against its campaign's stored log: a log whose current scenario is another one has written the game already, so nothing is pending. `AppState.writeResolution` takes the commands the players confirmed and appends `campaign.applyResolution`'s events as one campaign undo step, all or none. It remembers that step as `AppState.writtenResolution` (campaign and last `seq`), and the campaign screen offers to take it back (`ResolutionUndo`): `undoResolution` calls `GameStore.undoLastCampaign` with that `seq`, so a log changed since refuses instead of losing a later change, and the ended game proposes its resolution again. A standalone game proposes its resolution too, with no campaign to write it into.

Over an ended game, [`ResolutionPrompt`](../../apps/web/src/campaign/ResolutionPrompt.tsx) opens [`ResolutionDialog`](../../apps/web/src/campaign/ResolutionDialog.tsx) in two steps. "The scenario is over" lists the resolutions with the one the game reached tagged "from the game", for the players to confirm or change; "Into the campaign log" names the resolution to read aloud from the guide, lists the changes grouped like the log page (campaign notes, investigators, chaos bag, then the by-hand steps "At the table"), lets the players pick an option of each choice, and after the write goes to the campaign screen. It waits while the board is being adjusted, and "Not yet" closes it until the game is opened again. A standalone game gets the same steps, titled "Resolution steps", and "Done" closes them without writing.

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

## Strings

UI strings live in [`i18n/`](../../apps/web/src/i18n/), one folder per language: `app.ts` holds the app's own strings, and each campaign has a file of its own (`night_of_the_zealot.ts`) with its name, scenario names, scenario choices and story records. [`index.ts`](../../apps/web/src/i18n/index.ts) joins them by section (`CAMPAIGN_SECTIONS`: `campaigns`, `scenarios`, `scenario`, `story`), so the app's file doesn't grow with every campaign. The tests check that German has every English key and that no two campaigns write the same key.

## Extension points

- **A new game action:** add it to `GameActions` as one `PlayTable` verb (add the verb to `PlayTable` first). Only actions outside the open game get their own `AppState` method.
- **A new screen:** a route in `App.tsx`, a component in `screens/`, an E2E flow tagged `@flow` or a screenshot tagged `@shot`, strings in English and German.
- **A new refusal or skippable effect:** its `rejections.<code>` or `skipped.effects.<type>` string in English and German.
- **A new decision prompt or option label:** its string under the engine's key (`decision.<key>`, or the scenario's `scenario.<scenario>.<card>.<key>`) in English and German.
- **A new campaign's strings:** a `<campaign>.ts` file in both `i18n/en/` and `i18n/de/`, holding only the `CAMPAIGN_SECTIONS`, and listed in `campaignTexts`.

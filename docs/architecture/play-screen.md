# Play screen

The [game screen](../../apps/web/src/screens/GameScreen.tsx) shows, from top to bottom:

1. a header with the encounter piles, agenda, act and scenario ([encounter piles](play-screen-encounter.md)),
2. a status row,
3. the map ([map and locations](play-screen-map.md)),
4. and the investigator bar ([investigators and enemies](play-screen-investigators.md)).

The first open decision shows as a dialog over the board ([decisions](play-screen-decisions.md)).
Each part has its own page, so changes to different parts touch different files.

The [status row](../../apps/web/src/screens/GameStatus.tsx) has the round, the phase track, Next and round icon buttons for adjust, undo, the game log and a ☰ menu (the play screen hides the app's title bar, so its links and the export sit in that menu).

## Symbols

The game's own symbols (skills, wild, action, free, reaction, per investigator, the six classes, and the chaos tokens except the 2026 Core Set's blood, which the sheet lacks) are bundled as one-colour SVGs in [`symbols/`](../../apps/web/src/symbols/):

- one file per symbol named after the engine's name in snake case where it has one (`willpower.svg`, `elder_sign.svg` for `elderSign`),
- each in a 100×100 box with the glyph centred;
- components draw them as a CSS `mask` filled with the text colour, so one file serves both themes.

They were cut from the community sheet "Arkham Horror LCG Symbols – Main Sets – Core Game Set" (an Inkscape SVG that names no author or licence; its other pages hold the campaign and encounter set icons), which traces Fantasy Flight Games' printed icons, so they are © Fantasy Flight Games like the cards, which the settings' copyright notice says.

## Layout

Markup is structure only; the playmat look lives in CSS on [`tokens.css`](../../apps/web/src/styles/tokens.css), with a dark and a light theme.

The investigators stand in a column beside the map in landscape and below it in portrait (`orientation` media queries in [`game.css`](../../apps/web/src/screens/game.css)), as in the prototype.
The board stretches to the foot of the screen, so the map always takes the room the header, status row and investigators leave.

## Phone

A phone held upright (`(orientation: portrait) and (max-width: 40rem)`) gets the compact mode (M3.14, designed in the phone prototype of #432, removed once the app showed the same).
The same query opens a block in [`tokens.css`](../../apps/web/src/styles/tokens.css) (smaller header cards, tokens, skills and counters), `game.css` and [`investigators.css`](../../apps/web/src/investigators/investigators.css), written out in each, since a custom property cannot stand in a media query. On a phone:

- the header shows only its four cards in one row:
  - the slot labels are hidden for the eye only,
  - and the piles, the victory display and the card plates are hidden.
  - A tap on a card expands the header in place on it (below);
- the status row names only the current phase, so it stays on one line;
- the investigator bar shows one panel, the focused one (`data-focus`, `useFocus` in [`InvestigatorBar.tsx`](../../apps/web/src/investigators/InvestigatorBar.tsx): the one whose avatar was tapped until the turn changes, else the turn's, else the lead), without its art window, and the other investigators as round avatar buttons above it.
  The avatars are in the markup on every screen and hidden outside the phone, so the switch is CSS only.

### Detail view

On a phone a tap on a header card, the map's expand button or the investigator's name opens the **detail view** on it instead (`usePhone` and `useDetailView` in [`screens/`](../../apps/web/src/screens/), `#board[data-view]` naming the row shown: `cards`, `map` or `investigators`).
It rearranges the same parts and adds no second copy of them:

- The header expands in place (`cards`, M3.15a): its five places (its four cards and the victory display) snap sideways at a larger card size, with their labels, piles and plates back. The status row, the map and the compact investigator stay, and the map shrinks to the room left.
- The investigator bar expands in place the same way (`investigators`, M3.15b): every panel snaps sideways, the whole card (`WholeCard` in [`InvestigatorCard.tsx`](../../apps/web/src/investigators/InvestigatorCard.tsx), the card the art opens elsewhere, with its notebook page) in place of the strip, under the compact header and the shrunk map.
- The map (`map`) takes the whole screen, the other parts stepping aside.
- A vertical swipe does the same as the taps (M3.15c, [`useVerticalSwipe`](../../apps/web/src/screens/useVerticalSwipe.ts) on the board, [`swipeAction`](../../apps/web/src/screens/detailSwipe.ts)): down on the compact header expands it on the card under the finger, up on the compact investigators expands their bar on the panel under it, and the opposite swipe folds the expanded part. A swipe must travel twice as far up or down as across, so the sideways scrolling stays; a touch on a token to drag (`[data-drag]`) and the whole-screen map's panning never swipe.
- Beside an expanded part, a tap on the compact header, the map's expand button or the investigator's name moves the view there (`useDetailView().go`, which changes the target without a new history entry).

The agenda and act there are their full version (`GameHeader` `full`): their action rows sit under them, and a tap on one opens no second, full-card dialog as it does on the tablet.
The upright scenario card is too narrow at that size for its rows, so a tap on its name still opens its reference card.

[`DetailControls`](../../apps/web/src/screens/DetailControls.tsx) scrolls the row to the card or panel tapped and draws the × and a dot per card or panel from the row's scroll position.
Beside an expanded part the board's grid lays the × and the dots over that part's own area (the investigators' dots over the threat area, since the turn controls take the foot); over the whole-screen map the × floats at the top left.

- Opening pushes a history entry, so the back gesture, Escape and the × all close it through `history.back()`.
- While the compact view shows, a tap in a header place is caught in its capture phase (`HeaderSlot` `onOpen`), so the card's own buttons and dialogs wait for the detail view.

On the whole-screen map the map takes every touch (`touch-action: none`, besides the zoom library's own handlers), so panning never scrolls the page; a strip above and below the map ([`MapStrip`](../../apps/web/src/screens/MapStrip.tsx)) shows the numbers of the parts that stepped aside.

- The upper strip shows the cards row's numbers (doom, act clues, encounter deck, round and phase) as icons with the values,
- the lower one those of the turn's investigator, else the lead (actions left, counters, skills).

The strip's accessible name says them in words.
A tap on a strip expands the header on the agenda or the investigator bar on that investigator's panel (`go`).

### Location mode

On a phone a tap on a location, in the compact map or the whole-screen map, shows that location on the whole screen in place of the map (`{ row: 'map', location }`, [`LocationFocus`](../../apps/web/src/map/LocationFocus.tsx)) instead of the details dialog the tablet opens. The strips stay above and below it.

- Its content ([`LocationContent`](../../apps/web/src/map/LocationDetails.tsx)) is the card, the shroud and clues as a line, and the parts the details dialog's page shows too (`LocationPage`): who is there, the attached cards, and the action row or the corrections. The stylesheets share those rules (`:is(dialog[data-dialog='location'] > article, [data-mode='location'])`).
- Its connected locations sit around the card, each on the side where its tile lies on the map (`neighboursOf` in [`mapLayout.ts`](../../apps/web/src/map/mapLayout.ts): above or below where the centres lie further apart down than across, otherwise left or right).
  - Each neighbour is a small tile with its connection symbol, its name and the initials of who is there.
  - A barricaded neighbour (a card forbids moving in) has a dashed red frame, and a one-way connection into the shown location a dotted one; the tile's name says both.
  - A tap on a neighbour shows it instead (`go`, no new history entry), sliding in from that side unless the players prefer reduced motion.
- It stays on the location after a move or an investigation, since it is a row, not a window over it.
- The Map button brings the whole map back, and so does the location leaving play. While the players choose where a spawned enemy goes, the map shows until they place it.
- It takes the focus as it opens, so a keyboard tap on a tile's "i" button lands on it.

### Cards over the whole screen

The dialogs over the board share one column rule and one rule that hides them while closed (`game.css`): every card dialog's page (the clue payment and the encounter dialog among them) and the card zoom lay their parts out the same way, and each stylesheet adds only what differs.

On a phone a zoomed card (`CardZoom`: a card read whole from the card shell, a card attached to a location) is the same dialog as on the tablet, laid over the whole screen without its frame (`game.css`); an enemy's details (`EnemyDetails`) and a threat or play area card's (`CardDetails`) are on the card shell, so they are its sheet.
The back gesture closes them as it closes the detail view ([`useBackCloses`](../../apps/web/src/screens/useBackCloses.ts)): opening pushes a history entry named by a fresh id, and the ×, Escape and their buttons that close them (fight, evade) step back through it once.
The detail view names its own entry too and ignores a back step that lands on it.
A card that goes while it is open (an enemy leaving play) drops its entry a tick later, unless it mounts again at once (development's double effects), so no back step is left that changes nothing.

### Screen edges and turning

- The page reaches under a notch, rounded corners and the home bar (`viewport-fit=cover` in `index.html`).
  `#app` pads itself by the safe areas (`--safe-*` in `tokens.css`, from `env(safe-area-inset-*)`), and the detail view's floating ×, dots and notices add them to their insets.
- The play screen is `100dvh` tall, the visible height, so a phone's address bar never hides the strips or the turn controls.
- The web app manifest allows any orientation, so an installed app turns with the phone.
  A phone held sideways (`(orientation: landscape) and (max-height: 30rem)`) keeps the tablet's board, with the compact mode's header row and sizes (a second query on the first phone blocks of `tokens.css` and `game.css`), so the map and the investigator panel keep the screen's little height.
- Dialogs fit the phone's width; the encounter dialog shows two cards of a pile at a time.

## Game log

[`gameLog`](../../apps/web/src/log/gameLog.ts) reads the game's stored log as the players would tell it (M3.8):

- one step (`LogStep`) per undo group (`commandId`), the unit undo takes back, so the log and undo agree on what a step is;
- each step carries the round and phase it ended in, whose turn it was (the actor) and when it was stored (`GameSession.stepTimes`, from `StoredEvent.timestamp`);
- each event the players care about becomes one `LogLine`: its event type, its actor (the investigator it names, or the enemy that engaged or attacked) and a translated text (`log.*` strings), named with the cards and investigators of the state; bookkeeping (phase steps, queues, decisions asked, map layout) has none, and a step without lines is left out;
- a clue discovery is one line, without the location and investigator counters it moved;
- a line the game did by itself names why (`LogLine.cause`, from `LoggedEvent.cause`): the card whose forced ability it was, or the step of the round (`log.cause.*`, "mythos phase"); [`LineText`](../../apps/web/src/log/LineText.tsx) shows it after the line, quieter: "1 doom on What's Going On?! (mythos phase)".

The log button opens [`GameLogDialog`](../../apps/web/src/log/GameLogDialog.tsx). `logSections` cuts the steps, in the order played, into sections of one round and phase, and the dialog opens scrolled to the end, so the newest step shows first. Each section's heading sticks to the top while its steps scroll under it, so the round, phase and actor are never repeated on every line. It is not tied to a moment in the game and grows long, so it is a page of its own on the card shell without a card ([`CardDialog`](../../apps/web/src/screens/CardDialog.tsx)), with the scenario's name as its kicker: the screen's full height at the wide dialog width on a desktop or tablet, and the whole screen on a phone held upright, where it is no sheet. A step shows its actor and time above its lines, with a rule between steps. It reads `OpenGame.log` (the session's `entries`, `stepTimes` and the rules that name their cards), so it waits for no step.

Every step but the newest has "Go back here": after a confirm that counts the steps taken back, `GameActions.undoTo` takes back each later step, one undo group at a time (`GameSession.undoTo`, the same `GameStore.undoLast` as Undo), so the game is as it was right after that step. It waits like every other step, and the log offers it neither while a step is queued nor while the players adjust the board.

[`eventLines`](../../apps/web/src/log/gameLog.ts) is the same for one step's events. [`automaticChanges`](../../apps/web/src/log/gameLog.ts) uses it for what the game did by itself (M1C.2): the lines of the last step's events that a rule or a card's forced ability caused, in a step the players took too (a location's doom when revealed), but those the screen tells another way (the phase and turn, the encounter cards drawn). [`ChangesNotice`](../../apps/web/src/log/ChangesNotice.tsx) shows them with their cause ("Roland Banks gains 1 resource (upkeep phase)") and how to set a wrong one right (undo the step, or adjust by hand) among the notices, only for a step played while the screen is open, not for the step the game opened at or went back to. It asks nothing and fades out on its own (`--duration-notice`), opacity only, so reduced motion keeps it.

A counter shows where a change landed (M3.13b): [`useCountChange`](../../apps/web/src/screens/countChange.ts) remembers the last change of a count while it shows (none for the count first shown, so opening a game or a dialog plays nothing), and the counter's element takes it as its React `key`, which restarts its animation, and as `data-delta` ("+1", `deltaText`). `game.css` swells the counter and lets the change rise off it as generated content, out of the page's text and of screen readers, and only without reduced motion. The header tokens ([`Token`](../../apps/web/src/screens/Token.tsx): doom, clues, the deck's cards) and the investigator's counters (`Stat` in [`InvestigatorBar`](../../apps/web/src/investigators/InvestigatorBar.tsx)) use it, and so does an engaged enemy's health left in the threat area ([`ThreatArea`](../../apps/web/src/investigators/ThreatArea.tsx)). A drawing has no generated content, so its counts (M3.13c) draw the change as an `aria-hidden` text instead, [`RisingDelta`](../../apps/web/src/catalog/cardFace.tsx) (`data-rising`), in a group keyed by the change and marked `data-changed`, which pulses: the count circles of every card face (`CountCircle`: a location's clues, an enemy card's damage), a location tile's doom, and an enemy token's damage badge on the map ([`LocationTile`](../../apps/web/src/map/LocationTile.tsx)).

## Paper and frames

Screens outside play and every dialog are printed on campaign-guide paper ([`base.css`](../../apps/web/src/styles/base.css), MD.1 of the [design language](../product.md#design-language-md)): `--paper` with a darker edge and a shadow, the same in both themes, titles in Federant (`--font-family-print`) with a small ring under a screen's title ([`ornament_rule.svg`](../../apps/web/src/styles/ornament_rule.svg)).
The paper redefines the table's colour tokens (`--color-text`, `--color-border`, `--color-surface`, `--color-accent`, `--color-background`, and the game's clue, doom, health and sanity colours as their deeper day shades) as ink and paper, so text, buttons, fields and menus on it turn to ink without rules of their own; a new dialog needs nothing to look printed.
Buttons on the paper follow the form, not class names (MD.1b): a footer's buttons stand in one row as outlined pills, the button that submits the dialog's `<form>` is the view's one primary (a brass pill) and, in an `alertdialog` asking before something is removed, a red one. So a dialog marks its primary by making its main action the form's submit (`ConfirmDialog`, `CluePaymentDialog`).
Every dialog shares one shell (MD.1c): it is as wide as its content up to `--dialog-width` (a question, `alertdialog`, up to `--dialog-width-narrow`, the encounter piles up to `--dialog-width-wide`), padded by `--dialog-padding` (less on an upright phone), with its × (`button[data-icon='close']` as the dialog's direct child) in the top corner and a centred title kept clear of it. A title may stand under a kicker that says what the dialog belongs to: an `<hgroup>` with a `<p>` before the `<h2>` (the skill test names its investigator so).
In-game dialogs move onto the card dialog shell ([`CardDialog`](../../apps/web/src/screens/CardDialog.tsx), [`card_dialog.css`](../../apps/web/src/screens/card_dialog.css), MD.2a; the decision dialog first). The `<dialog>` is only a frame and its `<article>` is the paper page; `data-shell` lays it out:

- `beside`: the card it is about stands left of the page, turned a little and laid over its edge;
- `above`: a sideways card (agenda, act) stands over the page;
- `portrait`: without a card, the investigator who acts stands round and large over the page;
- `page`: the page alone.

With a card, the investigator who acts sits small in the kicker (their art cut from their card like the clue payment's avatars). The card is a button that opens it whole (`CardZoom`); the cards of the decisions that wait after it (`DecisionView.waiting`, the next enemies to attack) fan out behind it, to the left (to the right on a phone, where the card meets the screen's edge). On an upright phone the page is a sheet along the bottom with a grab handle and a footer of full-width buttons, and the card (or portrait) peeks out over its top edge on the left, beside the title; a sideways card (agenda, act) leaves too little room beside it, so the title starts under it.
A dialog with a drawing of its card (the enemy details' `EnemyCard`, which lays the picture over itself) passes it as `drawn`, shown in place of the picture. A card's values on the page (`article > dl`) stand side by side, each number in the guide's big print over its name.
A dialog that must be answered but leaves the board in reach (`onLower`, the decision) gets a grab handle at the top of its page instead: it lowers the dialog to a strip along the bottom with only the handle and the title, shown as a plain dialog (`show()`, not `showModal()`, which would make the board inert), so the players can tap the board and the header, and raises it again, as a tap anywhere on the strip does. The caller keeps whether it is `lowered`, since the decision's Pick on the map lowers it too.
The app's labels use the guide's fonts (Federant for titles and big numbers, Libre Caslon Text, `--font-family-label`, for labels and kickers); IM Fell English SC (`--font-family-display`) stays on the card faces.
The play screen's notices keep the playmat's frame (brass rules, a quarter of its zodiac ring and a star in each corner, [`panel_frame.svg`](../../apps/web/src/styles/panel_frame.svg) as a `border-image`, with a light-theme copy), the see-through night by night and parchment by day (`--panel-paper`).
The investigator cards are parchment in both themes, like printed cards and the location tiles.

## Extension points

- **A new event:** its line (or `undefined` for bookkeeping) in `eventLine`'s `switch`, which fails to compile until it has one, with en and de strings under `log`.
- **A new game symbol:** cut it from the symbol sheet into `symbols/<name>.svg` (one path, 100×100 box, no colour) and draw it with `mask: url(...)`.
- **A part that changes on a phone:** add its rules to the phone block of its stylesheet (same query as in `tokens.css`), and a size to the phone block of `tokens.css`; hide what the phone leaves out rather than rendering per screen size.

# Play screen

The [game screen](../../apps/web/src/screens/GameScreen.tsx) shows, from top to bottom, a header with the encounter piles, agenda, act and scenario ([encounter piles](play-screen-encounter.md)), a status row, the map ([map and locations](play-screen-map.md)) and the investigator bar ([investigators and enemies](play-screen-investigators.md)); the first open decision shows as a dialog over the board ([decisions](play-screen-decisions.md)). Each part has its own page, so changes to different parts touch different files.

The [status row](../../apps/web/src/screens/GameStatus.tsx) has the round, the phase track, Next and round icon buttons for adjust, undo and a ☰ menu (the play screen hides the app's title bar, so its links and the export sit in that menu).

The game's own symbols (skills, wild, action, free, reaction, per investigator, the six classes, and the chaos tokens except the 2026 Core Set's blood, which the sheet lacks) are bundled as one-colour SVGs in [`symbols/`](../../apps/web/src/symbols/), one file per symbol named after the engine's name in snake case where it has one (`willpower.svg`, `elder_sign.svg` for `elderSign`), each in a 100×100 box with the glyph centred; components draw them as a CSS `mask` filled with the text colour, so one file serves both themes. They were cut from the community sheet "Arkham Horror LCG Symbols – Main Sets – Core Game Set" (an Inkscape SVG that names no author or licence; its other pages hold the campaign and encounter set icons), which traces Fantasy Flight Games' printed icons, so they are © Fantasy Flight Games like the cards, which the settings' copyright notice says.

Markup is structure only; the playmat look lives in CSS on [`tokens.css`](../../apps/web/src/styles/tokens.css), with a dark and a light theme.

The investigators stand in a column beside the map in landscape and below it in portrait (`orientation` media queries in [`game.css`](../../apps/web/src/screens/game.css)), as in the prototype. The board stretches to the foot of the screen, so the map always takes the room the header, status row and investigators leave.

A phone held upright (`(orientation: portrait) and (max-width: 40rem)`) gets the compact mode of the [phone prototype](../../apps/web/public/prototype/phone/index.html) (M3.14). The same query opens a block in [`tokens.css`](../../apps/web/src/styles/tokens.css) (smaller header cards, tokens, skills and counters), `game.css` and [`investigators.css`](../../apps/web/src/investigators/investigators.css), written out in each, since a custom property cannot stand in a media query. On a phone:

- the header shows only its four cards in one row: the slot labels are hidden for the eye only, and the piles, the victory display and the card plates are hidden; a tap on the agenda or act still opens its full card with its buttons;
- the status row names only the current phase, so it stays on one line;
- the investigator bar shows one panel, the focused one (`data-focus`, `useFocus` in [`InvestigatorBar.tsx`](../../apps/web/src/investigators/InvestigatorBar.tsx): the one whose avatar was tapped until the turn changes, else the turn's, else the lead), without its art window, and the other investigators as round avatar buttons above it. The avatars are in the markup on every screen and hidden outside the phone, so the switch is CSS only.

On a phone a tap on a header card or on the investigator's name opens the **detail view** on it instead (`usePhone` and `useDetailView` in [`screens/`](../../apps/web/src/screens/), `#board[data-view='detail']`). It rearranges the same parts and adds no second copy of them: the stylesheets turn the header, the map and the investigator bar into three rows a screen tall, snapped vertically, and the header's five places (its four cards and the victory display) and every investigator panel snap sideways at full size, with their labels, piles and plates back. [`DetailControls`](../../apps/web/src/screens/DetailControls.tsx) scrolls to the card or panel tapped, draws the × and the row and card dots from the scroll positions, and moves the cards row back to the agenda once the players leave it. Opening pushes a history entry, so the back gesture, Escape and the × all close it through `history.back()`. While the compact view shows, a tap in a header place is caught in its capture phase (`HeaderSlot` `onOpen`), so the card's own buttons and dialogs wait for the detail view.

The web app manifest allows any orientation, so an installed app turns with the phone.

Screens outside play, dialogs and the play screen's notices (at half the frame width) share one frame in the playmat's line style (brass rules, a quarter of its zodiac ring and a star in each corner, [`panel_frame.svg`](../../apps/web/src/styles/panel_frame.svg) as a `border-image`, with a light-theme copy) and a small ring under each title ([`ornament_rule.svg`](../../apps/web/src/styles/ornament_rule.svg)); their panels are the see-through night by night and parchment by day (`--panel-paper`). The investigator cards are parchment in both themes, like printed cards and the location tiles.

## Extension points

- **A new game symbol:** cut it from the symbol sheet into `symbols/<name>.svg` (one path, 100×100 box, no colour) and draw it with `mask: url(...)`.
- **A part that changes on a phone:** add its rules to the phone block of its stylesheet (same query as in `tokens.css`), and a size to the phone block of `tokens.css`; hide what the phone leaves out rather than rendering per screen size.

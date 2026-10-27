# Play screen

The [game screen](../../apps/web/src/screens/GameScreen.tsx) shows, from top to bottom, a header with the encounter piles, agenda, act and scenario ([encounter piles](play-screen-encounter.md)), a status row, the map ([map and locations](play-screen-map.md)) and the investigator bar ([investigators and enemies](play-screen-investigators.md)); the first open decision shows as a dialog over the board ([decisions](play-screen-decisions.md)). Each part has its own page, so changes to different parts touch different files.

The [status row](../../apps/web/src/screens/GameStatus.tsx) has the round, the phase track, Next and round icon buttons for adjust, undo and a ☰ menu (the play screen hides the app's title bar, so its links and the export sit in that menu).

The game's own symbols (skills, wild, action, free, reaction, per investigator, the six classes, and the chaos tokens except the 2026 Core Set's blood, which the sheet lacks) are bundled as one-colour SVGs in [`symbols/`](../../apps/web/src/symbols/), one file per symbol named after the engine's name in snake case where it has one (`willpower.svg`, `elder_sign.svg` for `elderSign`), each in a 100×100 box with the glyph centred; components draw them as a CSS `mask` filled with the text colour, so one file serves both themes. They were cut from the community sheet "Arkham Horror LCG Symbols – Main Sets – Core Game Set" (an Inkscape SVG that names no author or licence; its other pages hold the campaign and encounter set icons), which traces Fantasy Flight Games' printed icons, so they are © Fantasy Flight Games like the cards, which the settings' copyright notice says.

Markup is structure only; the playmat look lives in CSS on [`tokens.css`](../../apps/web/src/styles/tokens.css), with a dark and a light theme.

The investigators stand in a column beside the map in landscape and below it in portrait (`orientation` media queries in [`game.css`](../../apps/web/src/screens/game.css)), as in the prototype.

Screens outside play, dialogs and the play screen's notices (at half the frame width) share one frame in the playmat's line style (brass rules, a quarter of its zodiac ring and a star in each corner, [`panel_frame.svg`](../../apps/web/src/styles/panel_frame.svg) as a `border-image`, with a light-theme copy) and a small ring under each title ([`ornament_rule.svg`](../../apps/web/src/styles/ornament_rule.svg)); their panels are the see-through night by night and parchment by day (`--panel-paper`). The investigator cards are parchment in both themes, like printed cards and the location tiles.

# Location symbols

Every location card prints a symbol in its upper left corner, in a colour fixed per symbol, and lists the symbols of the locations it connects to. ArkhamDB's card data has no field for either, so the app enters the own symbol by hand with the scenario's cards (`CardStats.symbol`, added in M3.14d). This page lists which symbols exist and which campaign needs which, so each one is drawn once, when the first scenario that uses it is built.

## How the list was made

On 2026-10-28 every location picture on ArkhamDB (`https://arkhamdb.com/bundles/cards/<code>.png` and its `b` side) was scanned: 2,177 of the 2,303 location sides had a picture. A script finds the symbol disc in the upper left corner, cuts out its glyph and groups the glyphs by shape and fill colour; the groups were then checked by hand. The per-card list (code, name, pack, front and back symbol) and the scripts are in the project library under `analysis/location_symbols/`, not in the repo, because they are derived from ArkhamDB data.

Front and back are ArkhamDB's sides: for most packs the back is the unrevealed side (all Arkham Woods show a square on the back), but check each pack against the card.

## The symbols

Fifteen glyphs, each always in the same colour. The hex values of the first ten are the ones the app uses, sampled from Night of the Zealot's pictures; the others get theirs with their task, checked against a card. The name is the suggested `LocationSymbol` value.

| Symbol         | Glyph       | Colour                | Sides | First needed by                             | Task            |
| -------------- | ----------- | --------------------- | ----- | ------------------------------------------- | --------------- |
| `circle`       | circle      | gold `#a78f32`        | 143   | The Gathering                               | M3.14d ([#448]) |
| `square`       | square      | red `#8f2e2f`         | 163   | The Gathering                               | M3.14d ([#448]) |
| `triangle`     | triangle    | blue `#3b5775`        | 154   | The Gathering                               | M3.14d ([#448]) |
| `plus`         | plus        | dark red `#4a2219`    | 105   | The Gathering                               | M3.14d ([#448]) |
| `diamond`      | diamond     | green `#557f47`       | 138   | The Gathering                               | M3.14d ([#448]) |
| `tilde`        | squiggle    | brown `#5c4a2e`       | 125   | The Midnight Masks (Your House)             | [#626]          |
| `moon`         | crescent    | purple-pink `#74404f` | 148   | The Midnight Masks (Easttown)               | [#626]          |
| `hourglass`    | hourglass   | maroon `#3e1f28`      | 87    | The Midnight Masks (Graveyard)              | [#626]          |
| `t`            | T           | navy `#1d2129`        | 83    | The Midnight Masks (Northside)              | [#626]          |
| `double_slash` | two slashes | dark green `#2f3f2c`  | 96    | The Devourer Below (Arkham Woods)           | [#626]          |
| `heart`        | heart       | orange                | 80    | Return to the Gathering (Bedroom)           | [#637]          |
| `star`         | star        | dark purple           | 88    | Return to the Gathering (Bathroom)          | [#637]          |
| `comma`        | curl        | rust                  | 36    | Return to the Devourer Below (Arkham Woods) | [#637]          |
| `spade`        | spade       | pink                  | 15    | Core Set (2026) (Your Friend's Room)        | [#638]          |
| `clover`       | clover      | teal                  | 31    | Core Set (2026) (Sewer Tunnels)             | [#638]          |

Two more cases are not glyphs:

- **Blank disc:** 14 unrevealed sides print an empty disc: the Exhibit Halls of The Miskatonic Museum and the altered paths of Where Doom Awaits ([#640]).
- **No symbol:** 671 sides print none. Most are locations that connect by position instead, like the Essex County Express train cars, In Too Deep's rows, and many locations of the Edge of the Earth, Scarlet Keys, Hemlock Vale and Drowned City boxes. Their tiles draw no disc.

## Symbols per campaign

After Core Set (2026) the app draws all fifteen glyphs, so later campaigns only enter their data (recipe step 2 in [tasks/README.md](tasks/README.md#recipe-per-new-scenario)).

| Campaign                  | Location cards | Glyphs beyond the first five                          | New for the app             | Sides differ | No symbol |
| ------------------------- | -------------- | ----------------------------------------------------- | --------------------------- | ------------ | --------- |
| Night of the Zealot       | 24             | tilde, moon, hourglass, t, double_slash               | those five (built, [#626])  | 6            | 0         |
| Return to NotZ            | 17             | heart, star, comma, t, moon, tilde                    | heart, star, comma ([#637]) | 4            | 0         |
| Core Set (2026)           | 26             | spade, clover, star, hourglass, t, moon, double_slash | spade, clover ([#638])      | 5            | 0         |
| Children of Blood         | 42             | unknown: no pictures on ArkhamDB yet                  | rescan ([#639])             | ?            | ?         |
| The Dunwich Legacy        | 109            | all but spade                                         | blank disc ([#640])         | 3            | 15        |
| The Path to Carcosa       | 119            | all but spade                                         | none                        | 0            | 16        |
| The Forgotten Age         | 114            | all but spade, clover                                 | none                        | 0            | 5         |
| The Innsmouth Conspiracy  | 101            | all but spade                                         | none                        | 9            | 68        |
| The Circle Undone         | 131            | all but comma                                         | none                        | 14           | 13        |
| The Dream-Eaters          | 93             | all but spade, clover                                 | none                        | 10           | 16        |
| The Edge of the Earth     | 74             | all ten                                               | none                        | 0            | 42        |
| The Scarlet Keys          | 93             | all but comma, clover                                 | none                        | 12           | 17        |
| The Feast of Hemlock Vale | 102            | all but t, tilde, comma                               | none                        | 0            | 67        |
| The Drowned City          | 93             | all but tilde, hourglass, clover                      | none                        | 0            | 56        |

"Location cards" counts each campaign's packs including its Return to box; "sides differ" counts cards with a different glyph on each side (a blank disc, no symbol or a missing picture doesn't count) (Arkham Woods, Sewer Tunnels, Enchanted Woods …), which need `unrevealedSymbol` ([#626]); "no symbol" counts fronts without one. Standalone scenarios (Curse of the Rougarou, Carnevale of Horrors, The Labyrinths of Lunacy …) use the same fifteen glyphs.

## Known gaps in the scan

- 126 sides had no picture on ArkhamDB, most of them Children of Blood (84), The Feast of Hemlock Vale (18, so its no-symbol count may be off) and the second sides of the Core Set (2026) Arkham locations (12145–12156); rescan them when ArkhamDB has them.
- The Return to Dunwich Exhibit Halls (51021, 51022) read as having no unrevealed symbol, while the originals show a blank disc; check the pictures ([#640]).

[#448]: https://github.com/macandy13/arkham-companion/issues/448
[#626]: https://github.com/macandy13/arkham-companion/issues/626
[#637]: https://github.com/macandy13/arkham-companion/issues/637
[#638]: https://github.com/macandy13/arkham-companion/issues/638
[#639]: https://github.com/macandy13/arkham-companion/issues/639
[#640]: https://github.com/macandy13/arkham-companion/issues/640

# M3 – Play screen UI: finished tasks

Finished tasks moved out of `docs/tasks/M3-play-screen-ui.md` so sessions working on open tasks read less. Their Done notes stay here for reference.

---

## M3.1 Game store and command dispatch (O)

**Why:** A single path from tap → engine → storage → screen enforces "persist before render" (refresh safety) and gives one place for errors and undo.

**Benefit:** Components stay simple, and the screen can never drift from the saved game.

- [x] Zustand store: current `GameState`, `actions.<verb>` → `PlayTable` → persist events via `GameStore` → re-render
- [x] Opening a saved game rebuilds its `EngineContext` (cards and `scenario`) from the catalog entry for `meta.scenarioId` (`findScenario`), so hooks and the reference card apply to its commands
- [x] Selectors for derived values (doom in play, agenda and act thresholds): `OpenGame.board`, a `BoardView`
- [x] A busy flag while a step runs, so the screen disables its buttons: actions act on the turn in progress and the first open decision, so a second tap would hit whatever is open next
- Moved to M3.2: rejected actions show a toast with the reason; the undo button

M3.1a done: the screen calls `GameActions` (the `PlayTable` verbs with screen defaults: actions are taken by the investigator whose turn it is, answers go to the first open decision, skill tests stay open) on the app store, which play them through a `GameSession` that stores each step as one undo group and reloads the stored game when a write fails (another tab). The refusal is kept on `OpenGame.rejection`; the undo button comes with the header.

M3.1b done: `GameActions` covers the remaining steps the screen needs: move, fight, evade, engage, resign and actions left (on the turn in progress), enemy attacks, act advance, the resource/damage/horror steppers and doom. Fight, evade and engage are not exercised through the app store yet, since The Gathering starts without an enemy in play.

M3.1c done: `OpenGame.board` is the screen's selector object, a `BoardView` built after every step; `AgendaView` gained the doom `threshold` and `BoardView` the `doomInPlay` it is compared with. `OpenGame.busy` is set while an action or undo is queued or running. The toast moved to M3.2, where the header's "Next" is the first button that can be refused.

## M3.2 Header (S)

**Why:** Round, phase, agenda doom and act clues are the scenario's always-on status. They are one important piece among others (map, investigators, encounter cards), so the header keeps them compact and leaves the space to the map.

**Benefit:** The game clock at a glance and one-tap phase progression.

- [x] Round, phase, "Next" button (calls `NextPhase`)
- [x] Agenda: doom x / threshold with +/−; act: clues x / threshold
- Moved to M3.7: tapping agenda or act opens the card (the card zoom comes with the decision dialog)
- [x] Undo button
- [x] Menu (home, settings, export): home and settings are the app header's links on every screen; the game header adds the export
- [x] Refused actions show a toast with the translated reason (`OpenGame.rejection`, `dismissRejection`); buttons disabled while `OpenGame.busy`

M3.2a done: the header shows round and phase, "Next" and undo (off while only the scenario start is left, `OpenGame.canUndo`); both wait while `busy` and stay off for a game that can only be shown. A refusal shows as a toast with the reason (`rejections.<code>` strings for the refusals a tap can cause, a general text otherwise) until dismissed. Flow: `play_header.spec.ts`.

M3.2b done: the header shows the current agenda with all doom in play against its threshold and +/− for the doom on the agenda (`removeDoom`, a new `PlayTable` verb and action, since no rule removes doom yet), and the current act with the clues the investigators hold against the clues it needs.

M3.2c done: the game header exports the open game (the same file as the home screen's export). Home and settings needed nothing new: the app's own header links to both on every screen, the play screen included.

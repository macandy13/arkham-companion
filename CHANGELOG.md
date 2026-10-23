# Changelog

The sections dated up to 2026-10-22 were released as 1.0.0 to 1.8.0 by mistake: Release Please starts at 1.0.0 by default. Versioning restarted at 0.1.0 (see "Versions" in docs/product.md).

## [0.1.3](https://github.com/macandy13/arkham-companion/compare/arkham-companion-v0.1.2...arkham-companion-v0.1.3) (2026-10-23)


### Features

* **web:** card faces show their ArkhamDB picture once it loads (M3.10c2) ([fac535e](https://github.com/macandy13/arkham-companion/commit/fac535e963b69f2d6bcad682b66a21e9f350af34))
* **web:** card faces show their ArkhamDB picture once it loads (M3.10c2) ([2ea93a3](https://github.com/macandy13/arkham-companion/commit/2ea93a375c5092ed66d4139d704b3c35cbcc51bb))


### Refactoring

* **web:** share escapeRegExp from util, keep the host out of the hook module ([0afea35](https://github.com/macandy13/arkham-companion/commit/0afea354e73ac1876e79e350421a14b2c07a975b))


### Documentation

* shorter PR descriptions with key-change snippets and links ([5330cf5](https://github.com/macandy13/arkham-companion/commit/5330cf5fe3a6f5836692034e0f62076e233929df))
* shorter PR descriptions with key-change snippets and links ([bffa40b](https://github.com/macandy13/arkham-companion/commit/bffa40b02394eae1f3c0a245ae2c3a798dc2f83e))

## [0.1.2](https://github.com/macandy13/arkham-companion/compare/arkham-companion-v0.1.1...arkham-companion-v0.1.2) (2026-10-23)


### Features

* add clue steppers to the act card that correct the clues on the act ([8ad3113](https://github.com/macandy13/arkham-companion/commit/8ad3113c5b396d013d67c248732f3b625cc26a3a))
* **web:** the act shows one clue counter, the clues on it, and advances with them ([e701f8e](https://github.com/macandy13/arkham-companion/commit/e701f8e6b94daae7eb7a39ed6802fcd400c2f3a0))

## [0.1.1](https://github.com/macandy13/arkham-companion/compare/arkham-companion-v0.1.0...arkham-companion-v0.1.1) (2026-10-23)


### Refactoring

* **engine:** drop failedBy options; the margin is the one way to say it (P2 slice 3a) ([7ad6639](https://github.com/macandy13/arkham-companion/commit/7ad6639ffe1626e0080b1a94839363b36e4edc0d))
* **engine:** pass amounts belong to action tests only; checkAmount ([8914e71](https://github.com/macandy13/arkham-companion/commit/8914e71c1f398918d98cd0500fdcb5114545a85c))

## [0.1.0](https://github.com/macandy13/arkham-companion/compare/arkham-companion-v1.8.1...arkham-companion-v0.1.0) (2026-10-23)


### Features

* **engine:** carry the margin in a skill test answer and its suggestion (P2 slice 2) ([22d3e58](https://github.com/macandy13/arkham-companion/commit/22d3e5866fae6f66fa1784bf246b6648386bf015))
* **web:** lay the game header out like the table and move export to the title bar ([a71a764](https://github.com/macandy13/arkham-companion/commit/a71a764ebc9643545e4f3b9ecd1a741d1e205645))
* **web:** stand the scenario card upright and move the round next to Next ([f7392c1](https://github.com/macandy13/arkham-companion/commit/f7392c148fab4112fce8c4e4505d19362c510667))
* **web:** stand the scenario card upright and move the round next to Next ([ba81090](https://github.com/macandy13/arkham-companion/commit/ba81090118c3551dab6536b92edf974190c12c59))


### Bug fixes

* **web:** let long scenario names wrap on the upright card, test where the round sits ([0297089](https://github.com/macandy13/arkham-companion/commit/0297089d8d1fe7181dfa1c9313bcefbd52e5d533))

## [1.8.1](https://github.com/macandy13/arkham-companion/compare/arkham-companion-v1.8.0...arkham-companion-v1.8.1) (2026-10-23)


### Features

* **engine:** pass each card side's picture path to the board views (M3.10c1) ([be3fde9](https://github.com/macandy13/arkham-companion/commit/be3fde97ff7a2b54dff736360a8fcf065e22f5aa))
* **engine:** pass each card side's picture path to the board views (M3.10c1) ([28c45e4](https://github.com/macandy13/arkham-companion/commit/28c45e4e2edcbadb9858c1f3bb6a8ce4b1e2854c))
* **web:** add the unofficial fan project notice to the settings (M3.10d) ([2c829aa](https://github.com/macandy13/arkham-companion/commit/2c829aab1a8effbc531c02d0aabc9a1d5f413b36))
* **web:** add the unofficial fan project notice to the settings (M3.10d) ([ef9135d](https://github.com/macandy13/arkham-companion/commit/ef9135dbe138d8ca47d6f550347807a76b0442a7))
* **web:** draw location tiles as card faces with tokens (M3.10a) ([9c17ed5](https://github.com/macandy13/arkham-companion/commit/9c17ed593b69c53eb8f7a157ed5d21f49701cc1b))
* **web:** put the doom steppers and advance on the agenda and act cards, as small buttons ([5c7e262](https://github.com/macandy13/arkham-companion/commit/5c7e262280f6370ab5035de6e5c49e2e094b16fc))
* **web:** show the agenda and act as landscape cards in the header (M3.10b) ([1ea2b07](https://github.com/macandy13/arkham-companion/commit/1ea2b07ce27c1d733793d6f659331512332308ad))
* **web:** show the agenda and act as landscape cards in the header (M3.10b) ([857dc69](https://github.com/macandy13/arkham-companion/commit/857dc698205b45f487cf4c4e7c7573ca3089b8cc))


### Bug fixes

* **engine:** cap clues at what is left, cover fight corrections, share answerOutcome ([fc01c65](https://github.com/macandy13/arkham-companion/commit/fc01c65842cd53b810fb74d5e46a715a794333fc))
* **engine:** compute an action's skill test results when the answer arrives (P2 slice 1) ([145ee34](https://github.com/macandy13/arkham-companion/commit/145ee348aebaaf9271b1a74ef646419118210723))
* **web:** credit only the card pictures as loaded from ArkhamDB ([1c8b5a5](https://github.com/macandy13/arkham-companion/commit/1c8b5a51e1001ec90da85ed59c6b6a0bcbb3a810))
* **web:** match the header cards' hatch to the map's; card tokens named for both uses ([bdfd7a2](https://github.com/macandy13/arkham-companion/commit/bdfd7a294b4eb599e1723ca5b1e0198e1425086b))


### Refactoring

* **engine:** compute an action's skill test results from the answer (P2 slice 1) ([75fa1b2](https://github.com/macandy13/arkham-companion/commit/75fa1b2c43bee4f8861f31fd22b1492f1a465ff7))


### Documentation

* plan the full agenda and act card behind the header cards ([1b619da](https://github.com/macandy13/arkham-companion/commit/1b619daecfe242aa8d8679ae7b1ab034d36d87df))
* say where card picture paths come from; doc fixes ([3232d34](https://github.com/macandy13/arkham-companion/commit/3232d34c9058c257598b189306b28c74803a01ed))

## 2026-10-22 (was 1.8.0)


### Features

* **engine:** a forced instruction moves an engaged enemy too ([0e1d2af](https://github.com/macandy13/arkham-companion/commit/0e1d2afb2bd46c1adb67c3bfd4ddcdad2331cd1d))
* **engine:** ability conditions on the current act; agenda 3 as an ability (P1 slice 5c3) ([9efa8f7](https://github.com/macandy13/arkham-companion/commit/9efa8f7bc47aa3dda0f4239b15d657da965b1107))
* **engine:** ability conditions, effects on each investigator at once; agenda 3 as an ability (P1 slice 5c3) ([0fba5a0](https://github.com/macandy13/arkham-companion/commit/0fba5a0ee5b83595644c09703b424592cd7c4c57))
* **engine:** enemy-defeated window for objectives, act 3's objective as an ability (P1 slice 5c1) ([9cd17d4](https://github.com/macandy13/arkham-companion/commit/9cd17d4ea8586587dfc16a875107de6daa745b57))
* **engine:** enemy-defeated window for objectives, act 3's objective as an ability (P1 slice 5c1) ([d70d360](https://github.com/macandy13/arkham-companion/commit/d70d360795535ae2140ac57104d12ebb40606ef6))
* **engine:** lead investigator reference and draw-until effects; agenda 2 as an ability (P1 slice 5c2) ([c9b9826](https://github.com/macandy13/arkham-companion/commit/c9b9826614c7e22bcbf51a6317f35bb95eb285fd))
* **engine:** lead investigator reference and draw-until effects; agenda 2 as an ability (P1 slice 5c2) ([35e96d5](https://github.com/macandy13/arkham-companion/commit/35e96d5ea195d87df150d4f4c2a2375d1ebcbe09))
* **engine:** lead investigator's choice as a card ability; act 3's reverse side on its card (P1 slice 5d1) ([8d6da5e](https://github.com/macandy13/arkham-companion/commit/8d6da5ed24c6a3d3b12e87f2bc7953781eb1cf7f))
* **engine:** lead investigator's choice as an ability; act 3's reverse side on its card (P1 slice 5d1) ([ccffb6f](https://github.com/macandy13/arkham-companion/commit/ccffb6fc5fce65d67027b1d64c469c867f74c77d))
* **engine:** move an enemy to a location by a card effect (M3.4b1) ([ae83d0a](https://github.com/macandy13/arkham-companion/commit/ae83d0acc807984ad2d6089eaa1e3ede74523dbd))
* **engine:** skill tests that deal damage or horror per point failed ([9475cc2](https://github.com/macandy13/arkham-companion/commit/9475cc2eae6ff9a8264f1e71ade5abfe3c13f78e))
* **engine:** skill tests that deal damage or horror per point failed ([547aa9e](https://github.com/macandy13/arkham-companion/commit/547aa9ef36bfdff910b312a08b79459d3d6689cc))
* move enemies by card effects and drag them on the map (M3.4b) ([c339346](https://github.com/macandy13/arkham-companion/commit/c339346bca2d3787ad194659e3c1ea7af1f60242))
* **scenarios:** act 1's reverse side as abilities (P1 slice 5b) ([f5ced37](https://github.com/macandy13/arkham-companion/commit/f5ced379e8bd562a324d4d941994a4d6c853dd93))
* **scenarios:** act 1's reverse side as abilities (P1 slice 5b) ([718e5c6](https://github.com/macandy13/arkham-companion/commit/718e5c64fcc5233e0259425481bdb389ab5cb425))
* **web:** advance the act from the header, recorded with the skipped-effect notice ([55a47d5](https://github.com/macandy13/arkham-companion/commit/55a47d5ef26e48f1ba7c61204415dfef39342efc))
* **web:** drag enemies to move or engage them (M3.4b2) ([523ebf5](https://github.com/macandy13/arkham-companion/commit/523ebf5f5bf98a055d7049cacc46b3dd8ea59ade))
* **web:** drag enemies to move or engage them (M3.4b2) ([3e49180](https://github.com/macandy13/arkham-companion/commit/3e49180ff96377fb2fcccfa21a1c8d32444a78c9))
* **web:** drag the pawn whose turn it is to move (M3.4a) ([ea260b5](https://github.com/macandy13/arkham-companion/commit/ea260b50bb1e3807e982b8b7db72710266ca4cef))
* **web:** drag the pawn whose turn it is to move (M3.4a) ([cc5f6c7](https://github.com/macandy13/arkham-companion/commit/cc5f6c7a0738167effb14383abfd18f609b6bafd))
* **web:** each map starts fitted after a tab switch; zoom shown in the map flow ([d05a3a4](https://github.com/macandy13/arkham-companion/commit/d05a3a4de992c64be5fb5ff1d26c6fa2857f65a1))
* **web:** location edit menu, and fix map panning (M3.4c) ([7f73aac](https://github.com/macandy13/arkham-companion/commit/7f73aac6e8cf7fb01bdd1b8cd117486a192cdbbf))
* **web:** location long-press menu (M3.4c) ([7dbb02c](https://github.com/macandy13/arkham-companion/commit/7dbb02cbf70c30c17e21c86a1432715f7217ce35))
* **web:** map tabs when several maps are visible (M3.3b2) ([a1cdb15](https://github.com/macandy13/arkham-companion/commit/a1cdb15ba3c5985f2582957eab597cdae7277c69))
* **web:** map tabs when several maps are visible (M3.3b2) ([88f8ee4](https://github.com/macandy13/arkham-companion/commit/88f8ee44caafc0a975d2b764b6e1b5edced753ea))
* **web:** pan, zoom and pinch the map (M3.3b3) ([5b51f48](https://github.com/macandy13/arkham-companion/commit/5b51f48a9a8a8fe67d360c50675c8363bf13c479))
* **web:** pan, zoom and pinch the map (M3.3b3) ([7b22a83](https://github.com/macandy13/arkham-companion/commit/7b22a8394f90a47aca985d92aa150116cfef7bfb))
* **web:** show card effects skipped for a missing card ([4bba6a8](https://github.com/macandy13/arkham-companion/commit/4bba6a8e86064404ba3a90e23571be73a438088d))


### Bug fixes

* **engine:** a move to the enemy's own location does nothing, engaged or not ([8f82208](https://github.com/macandy13/arkham-companion/commit/8f8220859327ec25c0cb57c6c50c6a6d9982e0c0))
* **engine:** apply "each investigator" effects at once; choose a new lead afterwards ([f0380d1](https://github.com/macandy13/arkham-companion/commit/f0380d1a7308c862dead45630fd2bae774237304))
* **engine:** each investigator in player order, report a missing eachEnemyAt location ([63b4b7d](https://github.com/macandy13/arkham-companion/commit/63b4b7d55a4354db2e18f62cd531e2f58421a147))
* **engine:** moving an enemy to its own location does nothing ([9cc239f](https://github.com/macandy13/arkham-companion/commit/9cc239f0cf5eb1921253f2c0a73b7b84bbb239f8))
* **engine:** narrow the no-match draw rule; test the lead reference after the lead left ([e94bd8d](https://github.com/macandy13/arkham-companion/commit/e94bd8d60d4555a7b5a79c993ba72ea9f54402f4))
* **engine:** refuse to move an engaged enemy by a card effect ([f22055f](https://github.com/macandy13/arkham-companion/commit/f22055f5e97fe801e68cafdcd00c7e4e5c78fb86))
* **engine:** stop an at-once effect at the first command that asks something ([9b1eb73](https://github.com/macandy13/arkham-companion/commit/9b1eb73e6bdd0f2a405b8b666a546e9148d24eeb))
* **web:** keep pawns still while a step is queued ([ed653e8](https://github.com/macandy13/arkham-companion/commit/ed653e8c31c4df101f4403861b18621e6cb349b5))
* **web:** location menu review: discover only where the investigator stands, pinch and iOS callout ([176e5b5](https://github.com/macandy13/arkham-companion/commit/176e5b53e7c025b76644bca41d0eb8168bd65852))
* **web:** no clue discovery on the location menu; investigating belongs to the investigator ([6b9e04f](https://github.com/macandy13/arkham-companion/commit/6b9e04fb147847b56800c4259619b6547a573cb9))
* **web:** open the location menu from an edit button on the tile; pan the map again ([9becd47](https://github.com/macandy13/arkham-companion/commit/9becd474a5adca302c5d4cea883afd0f3312b637))


### Refactoring

* **engine:** activeInvestigators helper; name the new-lead step after what it does ([9631dfb](https://github.com/macandy13/arkham-companion/commit/9631dfb3c1982b1b943f2786eb21454e9d6fb444))
* **engine:** compare timing windows as values; local objective test cards ([21a591b](https://github.com/macandy13/arkham-companion/commit/21a591b4567248256ec55f98341f937a1f351cf1))
* **engine:** one requireLocationInPlay for command destinations ([d529174](https://github.com/macandy13/arkham-companion/commit/d5291745cf1ef36e8c221431763d8dac3a9a1d6e))
* **engine:** per-point fails deal damage or horror directly; PlayTable answers them with failedBy ([9669012](https://github.com/macandy13/arkham-companion/commit/9669012e45130e57c62f2dd2b8817e1a9b848a77))
* **engine:** put a map into play as an AddMap effect ([fc9b575](https://github.com/macandy13/arkham-companion/commit/fc9b5751eb8c4f946834f179d251a8736065a57c))
* **engine:** remove ScenarioHooks; forced effects are card abilities only (P1 slice 5d2, 2/2) ([7a19515](https://github.com/macandy13/arkham-companion/commit/7a195159ed75398aeadd9055d32fe92fc4b85f43))
* **engine:** remove ScenarioHooks; forced effects are card abilities only (P1 slice 5d2) ([d95f2c3](https://github.com/macandy13/arkham-companion/commit/d95f2c340cee21fb612c115075850b0a4bb1e64e))
* **engine:** remove ScenarioHooks; forced effects are card abilities only (P1 slice 5d2b) ([e5e8559](https://github.com/macandy13/arkham-companion/commit/e5e8559f9e8e804f7d1cfaa505e59506899f057e))
* **web:** one pawn order for tiles and the engage target, review nits ([aee8734](https://github.com/macandy13/arkham-companion/commit/aee8734fcfcf16a294881fca1f8dd17276ea59e1))


### Documentation

* card data before the pipeline; milestone headings match product.md ([13717fc](https://github.com/macandy13/arkham-companion/commit/13717fcb308627fa799056f489dd4270525e4c8d))
* drop the last mentions of scenario hooks ([3cbe4f3](https://github.com/macandy13/arkham-companion/commit/3cbe4f3be0a1a88c26202a8142a6f6df8c729c89))
* encounter card coverage by rule and the gaps outside the plan ([8dad446](https://github.com/macandy13/arkham-companion/commit/8dad446d1615ce0ab84e1fdccb68919c00604911))
* encounter card coverage by rule and the gaps outside the plan ([2680d52](https://github.com/macandy13/arkham-companion/commit/2680d521e56bd4717e7658538fdded900381db56))
* **engine:** note how a choice drops and why its lists are mutable ([18f3642](https://github.com/macandy13/arkham-companion/commit/18f3642bb11bcd6afe030982bbb0fab85dfbd323))
* format the M3 task file ([5228b3b](https://github.com/macandy13/arkham-companion/commit/5228b3b1d568490d81eac06cd5741d28350d664e))
* list every timing window in step 2; fix review nits ([69aed03](https://github.com/macandy13/arkham-companion/commit/69aed0310cbb054f922177f4b94f464a058d6cf2))
* mark engine commands card data can't use yet; name conditional surge, spawn filters and shroud conditions in the plan ([6a66d26](https://github.com/macandy13/arkham-companion/commit/6a66d2695875f038e39d8e98e1d3137ae488245f))
* objective clue rule; note the fixed agenda-before-act order ([08033c3](https://github.com/macandy13/arkham-companion/commit/08033c332845dadc3ba05c631c0d3c77cbdc176e))
* plan card art and card-format layout (M3.10) ([fe7153f](https://github.com/macandy13/arkham-companion/commit/fe7153f4c31d8904673c8294d78e06d9010d0cb6))
* plan card art and card-format layout (M3.10) ([e688996](https://github.com/macandy13/arkham-companion/commit/e68899669982e16fb31c4543fe4930f7e6bebb2f))
* plan every encounter card gap and the milestones by campaign ([813a693](https://github.com/macandy13/arkham-companion/commit/813a69313aeaf0bf0ee25f0968b611b6be4e1a78))
* plan every encounter card gap, ordered by campaign ([4930b87](https://github.com/macandy13/arkham-companion/commit/4930b87ff9fe6b4ee44b33dc8943ef97cc5ecc68))
* plan the adjust board mode and token drag (M3.11) ([f420a8a](https://github.com/macandy13/arkham-companion/commit/f420a8a70d7161cc1feddba96537f9232dbbf243))
* re-plan milestones for Night of the Zealot first, then the campaign order ([9880e52](https://github.com/macandy13/arkham-companion/commit/9880e52d6bf7b5110690c0b6b611a5864d6802d0))

## 2026-10-21 (was 1.7.0)


### Features

* **engine:** agenda and act reverse sides as abilities (P1 slice 5a) ([2395403](https://github.com/macandy13/arkham-companion/commit/2395403dc8332d9193aac1c6a0e49aafb16a3b21))
* **engine:** agenda and act reverse sides as abilities (P1 slice 5a) ([72f590f](https://github.com/macandy13/arkham-companion/commit/72f590fefe9b617ada41f7b9675623a0d2cb67a4))
* **engine:** keep each location's book layout cell on its map (M3.3a1) ([322be50](https://github.com/macandy13/arkham-companion/commit/322be500b9ba40a57bb7c88c452687ae4c92904d))
* **engine:** lay maps out on a grid three times finer than a card ([5b49dda](https://github.com/macandy13/arkham-companion/commit/5b49dda8ae38483e0827a2cb6b0316b539446bb5))
* **engine:** location attachments attach by a revealed ability (P1 slice 4c) ([7601716](https://github.com/macandy13/arkham-companion/commit/76017165960dc3a160f29bb2fa047df688d06496))
* **engine:** location attachments attach by a revealed ability (P1 slice 4c) ([b3970ae](https://github.com/macandy13/arkham-companion/commit/b3970aef233e4cefb66231a1c663d7b98f1d0cfb))
* **engine:** revelation tests as card abilities (P1 slice 4a) ([9fb2c12](https://github.com/macandy13/arkham-companion/commit/9fb2c12fe6ef26126ec39dc6150ece2fd113b7b6))
* **engine:** revelation tests as card abilities (P1 slice 4a) ([a643ec0](https://github.com/macandy13/arkham-companion/commit/a643ec0546eeec387985850106ce07aaada41538))
* **engine:** threat-area treacheries as revealed abilities (P1 slice 4b) ([927482f](https://github.com/macandy13/arkham-companion/commit/927482f6b5dd4e627e2154be18e7344ee3621e7a))
* **engine:** threat-area treacheries as revealed abilities (P1 slice 4b) ([a4628fa](https://github.com/macandy13/arkham-companion/commit/a4628fa2ca69183a95e252b7de69b713a70b5099))
* **engine:** turn-end and round-end card abilities (P1 slice 3) ([dccd163](https://github.com/macandy13/arkham-companion/commit/dccd163eddbc310333eb5ab321444d0d5b76b9d5))
* **engine:** turn-end and round-end card abilities (P1 slice 3) ([226f583](https://github.com/macandy13/arkham-companion/commit/226f5835125296ffd97c26f4c973169601c9a278))
* **web:** card-shaped map tiles, centred maps fitted to the screen; check for an open game once ([e6c5041](https://github.com/macandy13/arkham-companion/commit/e6c504186beb754db80251498a6c97dd2864fab5))
* **web:** draw the visible maps with their location tiles and connections (M3.3a2) ([0918a51](https://github.com/macandy13/arkham-companion/commit/0918a51a624605e39c1ab0b60522768b58791bfe))
* **web:** draw the visible maps with their location tiles and connections (M3.3a2) ([199f4a2](https://github.com/macandy13/arkham-companion/commit/199f4a2ffec6499bc6ff278e0371b3adeda60ef8))
* **web:** place map tiles on the finer layout grid ([a0b8ad2](https://github.com/macandy13/arkham-companion/commit/a0b8ad2eef96305e5153bcfb64330004fa034b51))


### Documentation

* list BoardView.maps; say the tile size is a maximum ([7f59372](https://github.com/macandy13/arkham-companion/commit/7f5937266e1f03f6f0786ae72c91e2c02649bf35))

## 2026-10-20 (was 1.6.0)


### Features

* **engine:** card abilities with timing windows replace card scripts (P1 slice 2) ([021c861](https://github.com/macandy13/arkham-companion/commit/021c861b2e7fb53065def7120b04e122b95eef5d))
* **engine:** card abilities with timing windows replace card scripts (P1 slice 2) ([6efba10](https://github.com/macandy13/arkham-companion/commit/6efba107fa0398672cdf5911d53f795ac9a3a141))
* **engine:** factories for common ability effects ([e92b8b5](https://github.com/macandy13/arkham-companion/commit/e92b8b5cbad50630725a5ba2649c8cefb654817f))
* **web:** agenda doom and act clues in the header (M3.2b) ([565f8a0](https://github.com/macandy13/arkham-companion/commit/565f8a02bc4f1fffe31b18f02a54edd9f38e1425))
* **web:** agenda doom and act clues in the header (M3.2b) ([4e8c5fc](https://github.com/macandy13/arkham-companion/commit/4e8c5fca80790e80ba07e22e356be15c5a3dd002))
* **web:** board selectors and a busy flag on the open game (M3.1c) ([e59da98](https://github.com/macandy13/arkham-companion/commit/e59da98eb6544570ee6d4b42c8cf0acfcaf31822))
* **web:** board selectors and a busy flag on the open game (M3.1c) ([aef4094](https://github.com/macandy13/arkham-companion/commit/aef4094ba014216fd9f2c1140cda7e9011e25f83))
* **web:** export the open game from the header (M3.2c) ([ba47296](https://github.com/macandy13/arkham-companion/commit/ba47296bfc24275c6f11bf78852c4263b1d27c77))
* **web:** export the open game from the header (M3.2c) ([27f1884](https://github.com/macandy13/arkham-companion/commit/27f188499bdb18a960c8ad9c264551b38b0ba326))
* **web:** header with Next, undo and a toast for refused steps (M3.2a) ([6698ff1](https://github.com/macandy13/arkham-companion/commit/6698ff1551fd8f84b97094bc12e099f2b0db2797))
* **web:** header with Next, undo and a toast for refused steps (M3.2a) ([daab772](https://github.com/macandy13/arkham-companion/commit/daab77224346f7cf488568ecae2b21fa40134aec))


### Bug fixes

* **engine:** engage freed enemies after an elimination; read attacks still due ([d5965ca](https://github.com/macandy13/arkham-companion/commit/d5965ca379ef26662470d21c3167fd48026d827b))
* **engine:** finish the timing suite and engage freed enemies after an elimination (M1V.2) ([7a7ba0c](https://github.com/macandy13/arkham-companion/commit/7a7ba0c41f26e792e8c9c34196a79a597d9a6013))
* get main green after the major dependency upgrade ([5c8b649](https://github.com/macandy13/arkham-companion/commit/5c8b6494d1dd54d1ed98ee9e03087ccf1d222c61))
* get main green after the major dependency upgrade ([835df93](https://github.com/macandy13/arkham-companion/commit/835df934b568d4b7491c34d23321412e22bb354e))
* keep TypeScript on 6.x and declare node types (same change as [#152](https://github.com/macandy13/arkham-companion/issues/152)) ([71daf3d](https://github.com/macandy13/arkham-companion/commit/71daf3d0a6f45dd5f1275f67506aa1667d32da8b))
* **web:** player page plays only flows written into it ([612e62a](https://github.com/macandy13/arkham-companion/commit/612e62a72789eecf48d0b29e9140d76191f23ac3))


### Refactoring

* **engine:** ability effects are templated commands ([dd97f9b](https://github.com/macandy13/arkham-companion/commit/dd97f9b204ecc7f0e45710375090d03d8decb5c1))
* **engine:** ability effects are templated commands (names) ([c79aaaf](https://github.com/macandy13/arkham-companion/commit/c79aaaf1a69640482c4a2adc75e0e76293f2c17b))
* **engine:** ability effects mirror their commands with a relative target ([76f8bd1](https://github.com/macandy13/arkham-companion/commit/76f8bd1ac79009bb3d64f0348238e3a5a7f1f86c))
* **engine:** derive BoardView fields when read ([c56841e](https://github.com/macandy13/arkham-companion/commit/c56841ebba25935a95ef4a5726ba517ef1cc12e8))
* **engine:** read the clues held from BoardView; refuse non-positive doom removal ([7d4ccd9](https://github.com/macandy13/arkham-companion/commit/7d4ccd95930b1c4a3d44ee26ec0a3f1d1dbb2275))
* **web:** export a game through one helper so both screens name the file alike ([82202a7](https://github.com/macandy13/arkham-companion/commit/82202a75cf0e2f627782e9cae35637a3e4c58597))
* **web:** keep the toast's own strings apart from the rejection texts ([45b696a](https://github.com/macandy13/arkham-companion/commit/45b696aa20a9cfc34ec6282c82ce371003da2c89))


### Documentation

* new screens tag only their own flow ([a112bcb](https://github.com/macandy13/arkham-companion/commit/a112bcb709e125d357859783697463baec03e61c))
* tag flows whose recorded behavior changes, not only edited specs ([b84a265](https://github.com/macandy13/arkham-companion/commit/b84a265c03b0aa543e80245a9dbadf4950de4bc5))

## 2026-10-20 (was 1.5.0)


### Features

* **engine:** accept bare ids and enemy matchers in BoardView finders (M1.14) ([a11d3bd](https://github.com/macandy13/arkham-companion/commit/a11d3bd8d4f6a82572b347b6b96cf04ebdeac1b9))
* **engine:** add BoardView, structured read-backs of the board (M1.14) ([756d6b6](https://github.com/macandy13/arkham-companion/commit/756d6b6dfececb3549a335d25b0076925a784928))
* **engine:** add PlayTable, a stateful API to play a built table (M1.14) ([51c9bde](https://github.com/macandy13/arkham-companion/commit/51c9bde2948faf4ae4ec0e5da0e8985cd638194b))
* **engine:** one undo group per PlayTable step, resume from a stored log (M3.1) ([2ebe3b5](https://github.com/macandy13/arkham-companion/commit/2ebe3b507e7b6245b43a8f54f143b4c05e4885eb))
* **engine:** PlayTable steps as undo groups, step(), canUndo and resume (M3.1) ([ea079ae](https://github.com/macandy13/arkham-companion/commit/ea079ae4fdd0f9744476ab83705a6ae5546147c7))
* **engine:** PlayTable takes investigator, card and enemy refs (M1.14) ([666daa6](https://github.com/macandy13/arkham-companion/commit/666daa6f4316ec656ac7075847b37b1de857845d))
* **engine:** PlayTable.step plays several verbs as one step; canUndo (M3.1) ([d40b2a9](https://github.com/macandy13/arkham-companion/commit/d40b2a91af26a60beb2c014e3f6b69fb6d671d66))
* **web:** core game actions for the play screen through a GameSession (M3.1a) ([5e9b8cb](https://github.com/macandy13/arkham-companion/commit/5e9b8cb9eb2f267f96b28cafb56d93c5065323eb))
* **web:** dispatch and undo engine commands through the app store (M3.1) ([c291130](https://github.com/macandy13/arkham-companion/commit/c2911300adc929fd483f66d6aba1674533429fb7))
* **web:** the remaining play screen actions (M3.1b) ([23d73ba](https://github.com/macandy13/arkham-companion/commit/23d73ba3588fd873047cdd6ae0321bbc24aabb82))
* **web:** the remaining play screen actions (M3.1b) ([9896889](https://github.com/macandy13/arkham-companion/commit/989688973ebd9675091dfddc821a9ba9c04f66e2))


### Bug fixes

* **engine:** start a resumed table's undo groups above every stored id (M3.1) ([70646ff](https://github.com/macandy13/arkham-companion/commit/70646ff9509578e1becee257bd9b53e07f6fdd2e))
* **web:** play a step atomically and roll back before reloading a failed write (M3.1) ([180aa40](https://github.com/macandy13/arkham-companion/commit/180aa40290540e075e30a2bc179167b1eebde02c))


### Refactoring

* **scenarios:** play the end-to-end test on PlayTable, delete TestTable (M1.14) ([28a42b4](https://github.com/macandy13/arkham-companion/commit/28a42b486d29cc52ec8a54b536ead901ec341b8f))
* **web:** act on the turn in progress and the first open decision ([01acb8a](https://github.com/macandy13/arkham-companion/commit/01acb8af69a89abd2985dee0a03de4fbc072b41f))
* **web:** hide PlayTable behind GameActions with screen defaults (M3.1) ([beb94bf](https://github.com/macandy13/arkham-companion/commit/beb94bff142b9e14f725c1266a6f95f92c9ce873))
* **web:** keep the core GameActions in this PR; the rest follow in M3.1b ([444ab79](https://github.com/macandy13/arkham-companion/commit/444ab794a9f4dae23a33a560ca9015a6924b5094))
* **web:** play PlayTable steps through a GameSession instead of raw commands (M3.1) ([bae2134](https://github.com/macandy13/arkham-companion/commit/bae2134d70c6a12481ed445a9a1bb0951468969a))
* **web:** simplify startGame and name the no-turn test's state ([8691bd3](https://github.com/macandy13/arkham-companion/commit/8691bd36c1e806242db445f95ecf9f9c8f571b9c))


### Documentation

* add the main pieces and the card and identifier types to the architecture overview ([4f92224](https://github.com/macandy13/arkham-companion/commit/4f922244cb92ca142137e0ba7fe756affd41135b))
* add the main pieces and the card and identifier types to the architecture overview ([74a9804](https://github.com/macandy13/arkham-companion/commit/74a9804d13ab714deea28d005cd1357f7e887c12))
* correct classes, ids.ts link and setup instance IDs in the overview ([959ef0b](https://github.com/macandy13/arkham-companion/commit/959ef0b45e30cf3b4e10ded25f410c8e8db75d35))
* **engine:** word enemy refs and the enemy matcher description clearly (M1.14) ([ea6457a](https://github.com/macandy13/arkham-companion/commit/ea6457abbd14c722c757c4f86d4b64dbbdf9ca7a))
* note that a surge draw is lost when the card eliminates the drawer ([3458cf1](https://github.com/macandy13/arkham-companion/commit/3458cf18d62b8ab795a6e2e0572da38b5bbce0a8))
* **web:** name OpenGame in the action flow; retitle the dispatch test (M3.1) ([710ae7c](https://github.com/macandy13/arkham-companion/commit/710ae7ce064c7f2dc02dee95b30f3e7861cb96e3))
* **web:** show the web app's util dependency; tie SteppedStat to InvestigatorStat (M3.1) ([60f0703](https://github.com/macandy13/arkham-companion/commit/60f070365df82c7ca45e83636ac557350b61fde1))
* weekly docs sync (2026-10-18) ([78ee486](https://github.com/macandy13/arkham-companion/commit/78ee4863c6b98222193a77fd52a14c8fe629dd2e))

## 2026-10-19 (was 1.4.1)


### Bug fixes

* **engine:** repair the rat engagement test after [#130](https://github.com/macandy13/arkham-companion/issues/130); close M1V.3 ([cc0af2a](https://github.com/macandy13/arkham-companion/commit/cc0af2a8018805acb69037afd3ad644f58bb8251))

## 2026-10-19 (was 1.4.0)


### Features

* **engine:** let the table builder set difficulty, seed, shuffle and maps ([01d6508](https://github.com/macandy13/arkham-companion/commit/01d6508aa08cce9f35f01612e19531312e739259))
* **engine:** let the table builder set difficulty, seed, shuffle and maps (M1V.3, 7/9) ([fd547a4](https://github.com/macandy13/arkham-companion/commit/fd547a4aea9a854e28656bf0985144df97c65930))
* **engine:** provoke attacks of opportunity only for commands taken as actions ([ae582ca](https://github.com/macandy13/arkham-companion/commit/ae582ca91d6d6277099077f0285125d2dd8aa021))
* **engine:** provoke attacks of opportunity only for commands taken as actions ([44d0b2d](https://github.com/macandy13/arkham-companion/commit/44d0b2de1ce930a8a63e96e45dccf1a8336952a7))


### Bug fixes

* **engine:** address the review and rules findings on asAction ([949f5f3](https://github.com/macandy13/arkham-companion/commit/949f5f3657d1f9b08451b48adbae102eca7fdba2))


### Refactoring

* **engine:** add a game table builder and blank cards (M1V.3, 1/4) ([536b7a2](https://github.com/macandy13/arkham-companion/commit/536b7a21669f4f1ee4c89eab4c4c70527fc351e9))
* **engine:** add a game table builder and blank cards for tests ([2c8c254](https://github.com/macandy13/arkham-companion/commit/2c8c25407544c631aaf6840b9ed5b4cd3eb25318))
* **engine:** address review nits on the table builder ([68e6e12](https://github.com/macandy13/arkham-companion/commit/68e6e1270e18e481b14c489ad4bf48b1a84cac8a))
* **engine:** address review of the step queue; document the timing rules it follows ([474a502](https://github.com/macandy13/arkham-companion/commit/474a5024e70ce2f258137ba97da633142786e0cc))
* **engine:** build CurrentCardChanged in a helper ([bcaee62](https://github.com/macandy13/arkham-companion/commit/bcaee6250a520f0bca340a75315b5a48cfcd1fd1))
* **engine:** end the last card's advance with early returns ([bad5871](https://github.com/macandy13/arkham-companion/commit/bad5871fcb690c4fed741520dc16e914a9c9c80b))
* **engine:** name the DrawEncounter continuation ([bb53e39](https://github.com/macandy13/arkham-companion/commit/bb53e39b0b806422549c872c0ded17513c319345))
* **engine:** resolve every command as a queue of steps that waits for decisions (P8) ([2b51cc4](https://github.com/macandy13/arkham-companion/commit/2b51cc4e7b17a5c521e24bfcb7250c78243d8cd1))
* **engine:** resolve every command as a queue of steps that waits for decisions (P8) ([c591147](https://github.com/macandy13/arkham-companion/commit/c5911474c302a1bb32c50bb9234505f8f15c2218))
* **engine:** store waiting steps in a queue instead of the held-action slot (P8) ([ba80a89](https://github.com/macandy13/arkham-companion/commit/ba80a89678665130070a7a385d383bd94875ad5e))
* **engine:** store waiting steps in a queue instead of the held-action slot (P8) ([62f2e00](https://github.com/macandy13/arkham-companion/commit/62f2e008c8ded4405ad8678b1e6d171f340e6a48))
* **engine:** take a blank card's required values as parameters ([1836ac1](https://github.com/macandy13/arkham-companion/commit/1836ac11f465b59c2726d8ff323b4ee54e651bb5))
* **engine:** type spec continuations so every one takes its follow-up's origin ([55a8441](https://github.com/macandy13/arkham-companion/commit/55a84411208024c2a838a1d19263bded1561f790))


### Documentation

* **engine:** name the builder's maps and start options in its docs ([a54d4a2](https://github.com/macandy13/arkham-companion/commit/a54d4a24c10109bd1d34702fc1629b3d027066e4))
* list the next test helper follow-ups ([c55456c](https://github.com/macandy13/arkham-companion/commit/c55456c1a86e3950e7feb8ec53eb966f25bd1009))
* plan the asAction flag and the timing suite after P8 ([f857f04](https://github.com/macandy13/arkham-companion/commit/f857f04fa7d593a325e58c009af6586a3b89f375))

## 2026-10-18 (was 1.3.1)


### Refactoring

* **engine:** grow one resolution per handle call ([867ea13](https://github.com/macandy13/arkham-companion/commit/867ea13552776bcb42f2c0c241c11b5b6ae8faaf))

## 2026-10-18 (was 1.3.0)


### Features

* **engine:** add campaign events and the campaign reducer (M1C.1, 2/6) ([5d3027d](https://github.com/macandy13/arkham-companion/commit/5d3027d23097361d1c2e92de5252c591322f1f4a))
* **engine:** add campaign events and the campaign reducer (M1C.1, 2/6) ([9c40b40](https://github.com/macandy13/arkham-companion/commit/9c40b40651e6619d7c60660bace211a1a7cb420c))
* **engine:** add the campaign log and its invariants (M1C.1, 1/6) ([b4c41f6](https://github.com/macandy13/arkham-companion/commit/b4c41f6465c88203204dfb4f29f738c0fca56ac0))
* **engine:** add the campaign log and its invariants (M1C.1, 1/6) ([251ef26](https://github.com/macandy13/arkham-companion/commit/251ef26114dc201aaa76770bd4c45425748bf165))
* **engine:** attach treacheries to locations from card data (Obscuring Fog) ([8a98c07](https://github.com/macandy13/arkham-companion/commit/8a98c074a713a4097f102d879f5d01790e1dcbe9))
* **engine:** attach treacheries to locations from card data (Obscuring Fog) ([21ff2eb](https://github.com/macandy13/arkham-companion/commit/21ff2eb6aeddb1ef5f33c053e601bf371e13cf5a))
* **engine:** campaign XP, trauma, fate and replacements (M1C.1, 4/6) ([fa57c47](https://github.com/macandy13/arkham-companion/commit/fa57c478233ee2d9c298ebf79dfb741e3478c208))
* **engine:** campaign XP, trauma, fate and replacements (M1C.1, 4/6) ([e6d7867](https://github.com/macandy13/arkham-companion/commit/e6d7867fb6b2ee59ee520d5db3ac6fadd710b5b0))
* **engine:** check who answers a decision against its decider (M1.18) ([f49b33b](https://github.com/macandy13/arkham-companion/commit/f49b33b20c9f070e2494e50cc9e37ccfb1c305e5))
* **engine:** check who answers a decision against its decider (M1.18) ([2f3970f](https://github.com/macandy13/arkham-companion/commit/2f3970f30b501081fb7b2e2bed938b31ce14e4de))
* **engine:** correct the campaign log by hand (M1C.1, 5/6) ([e4582f3](https://github.com/macandy13/arkham-companion/commit/e4582f3c741460aed6ef1a6de9d7d7d0663b0df0))
* **engine:** correct the campaign log by hand (M1C.1, 5/6) ([debe31d](https://github.com/macandy13/arkham-companion/commit/debe31d06dc5c07d42427db7c009954e902e94ea))
* **engine:** end-of-scenario guard, discard shuffle and card-effect defeat (M1.17) ([b427a02](https://github.com/macandy13/arkham-companion/commit/b427a02849e24e17daacef8db4b749142a7dc169))
* **engine:** end-of-scenario guard, discard shuffle and card-effect defeat (M1.17) ([152c227](https://github.com/macandy13/arkham-companion/commit/152c227bf9ca5e19d9d8f2c5b67ab2b7515f7697))
* **engine:** end-of-turn tests and end-of-round discards (M1.18) ([5d239c9](https://github.com/macandy13/arkham-companion/commit/5d239c9b7ae66e90611339a21204d0984158daa1))
* **engine:** end-of-turn tests and end-of-round discards (M1.18) ([cff74d8](https://github.com/macandy13/arkham-companion/commit/cff74d8fbd0cab9ca06d1ffdeef2ec070248d802))
* **engine:** engage ready enemies when an investigator moves in (M1.16) ([144611c](https://github.com/macandy13/arkham-companion/commit/144611ca10230dc7ece2baabb8481769585a4de2))
* **engine:** engage ready enemies when an investigator moves in (M1.16) ([f418c0a](https://github.com/macandy13/arkham-companion/commit/f418c0a2bf843a33ae589a70b57f5fb09d812ce2))
* **engine:** guard manual corrections of doom and the current agenda/act (M1.18) ([0219462](https://github.com/macandy13/arkham-companion/commit/02194621a2541814172fb27899da16fc7a871b50))
* **engine:** guard manual corrections of doom and the current agenda/act (M1.18) ([00f4c9c](https://github.com/macandy13/arkham-companion/commit/00f4c9c123abc3f9c2563ffc7864dcdf5946a104))
* **engine:** joining investigators bring their printed name ([a9017a6](https://github.com/macandy13/arkham-companion/commit/a9017a6786aa9d606841920cfd5bedf2ab15356e))
* **engine:** let card-effect moves avoid engagement; add cardsAtLocation ([d78bab3](https://github.com/macandy13/arkham-companion/commit/d78bab3cb37933d4f2b74e04f66994bbff15e329))
* **engine:** record clue discoveries and skill test outcomes as events ([0704881](https://github.com/macandy13/arkham-companion/commit/07048812387c34ed0e30181a8e27e374c5aa2c95))
* **engine:** record clue discoveries and skill test outcomes as events ([9f877f2](https://github.com/macandy13/arkham-companion/commit/9f877f298d52066d25da14a1312af10b79a8a8cf))
* **engine:** retaliate and alert attacks after a failed fight or evade (M1.16) ([942ff85](https://github.com/macandy13/arkham-companion/commit/942ff857c7a5755162efc6bc831952802a3af7f1))
* **engine:** retaliate and alert attacks after a failed fight or evade (M1.16) ([8ec4d3c](https://github.com/macandy13/arkham-companion/commit/8ec4d3c8e14b796b4f59130c12b9b73225dd5246))
* **engine:** start a campaign, record story and change the chaos bag (M1C.1, 3/6) ([63ea208](https://github.com/macandy13/arkham-companion/commit/63ea20832447099279a2f7fa61dad703722b3ca0))
* **engine:** start a campaign, record story and change the chaos bag (M1C.1, 3/6) ([785b36c](https://github.com/macandy13/arkham-companion/commit/785b36c8d33747d64f940e580d11fa3fdcf8bdca))
* **scenarios:** Frozen in Fear and Dissonant Voices timings in The Gathering (M1.18) ([2606406](https://github.com/macandy13/arkham-companion/commit/26064069b5b1e8b700a77bb18fe3a0f049722a3d))
* **scenarios:** Frozen in Fear and Dissonant Voices timings in The Gathering (M1.18) ([eca337c](https://github.com/macandy13/arkham-companion/commit/eca337c000a851dae5e2147860c634e07c6dcdea))
* **scenarios:** Night of the Zealot campaign definition (M1C.1, 6/6) ([e98d754](https://github.com/macandy13/arkham-companion/commit/e98d754ac00cc0da0e889990046fd211ebf84580))
* **scenarios:** Night of the Zealot campaign definition (M1C.1, 6/6) ([78245ca](https://github.com/macandy13/arkham-companion/commit/78245cacc4a8b1222fec24861f5877f3fe388de1))
* **scenarios:** play The Gathering to a resolution (M1.17) ([91f6ce5](https://github.com/macandy13/arkham-companion/commit/91f6ce5536ab9652f6d85fb48e55077a4a221ecc))
* **scenarios:** play The Gathering to a resolution (M1.17) ([7a83f36](https://github.com/macandy13/arkham-companion/commit/7a83f367568694bb48e0c6965828f862bdffe294))
* **scenarios:** play The Gathering to a resolution (M1.17) ([77b13e2](https://github.com/macandy13/arkham-companion/commit/77b13e2a5edc4d3daa1835d2b692ded698377029))


### Bug fixes

* **engine:** allow living former investigators whose player left ([e4b1f76](https://github.com/macandy13/arkham-companion/commit/e4b1f76c0dc56218dc13e12dad86331b0b3a2676))
* **engine:** an empty discard shuffles nothing; export matchesEncounter ([e273bf0](https://github.com/macandy13/arkham-companion/commit/e273bf0f8df57487d1a221426f864835e17e1ba4))
* **engine:** an enemy with a spawn instruction still spawns when its revelation defeated the drawer ([768ab94](https://github.com/macandy13/arkham-companion/commit/768ab94b7df6c5fb0b831c914e386c5f94c41b5f))
* **engine:** draw surge only after the drawn card has resolved (M1V.1) ([5990663](https://github.com/macandy13/arkham-companion/commit/5990663a7e005784769d2e0a0271aa821ef341b5))
* **engine:** draw surge only after the drawn card has resolved (M1V.1) ([ed65d9d](https://github.com/macandy13/arkham-companion/commit/ed65d9de0e8d31f586844cac0f975987954d4097))
* **engine:** no threshold question after the scenario has ended ([e9ba9a0](https://github.com/macandy13/arkham-companion/commit/e9ba9a0e8f8ac57cddacdccf9f767d5c96bf77c8))
* **engine:** only a decision the reverse side raised stands in for the resolution ([af1da4d](https://github.com/macandy13/arkham-companion/commit/af1da4d7cf8c9f4bad38a4f828e653199fb00aa6))
* **engine:** only remove story records the log really has ([71e881a](https://github.com/macandy13/arkham-companion/commit/71e881a99c48a2c76634b1a6ef63c13e56f68347))
* **engine:** refuse padded story keys and state who advances the scenario ([5c7dbe8](https://github.com/macandy13/arkham-companion/commit/5c7dbe8af5340232a9438ddc833a18ea004c8f12))
* **engine:** resolve a drawn card's revelation before placing it (M1V.1) ([c3c1dc7](https://github.com/macandy13/arkham-companion/commit/c3c1dc7d79d2e951a711e0aed1268706309fd706))
* **engine:** resolve a drawn card's revelation before placing it (M1V.1) ([7eadee3](https://github.com/macandy13/arkham-companion/commit/7eadee32c0bf0733481633b083ee734b439ea586))


### Refactoring

* **engine:** address the review of the campaign log slice ([8a376a7](https://github.com/macandy13/arkham-companion/commit/8a376a7dace2d0e8528607b5e3fca064e3465770))
* **engine:** brand card codes as CardCode ([8808276](https://github.com/macandy13/arkham-companion/commit/8808276424cb174b7e1a37b36784de81bd348dac))
* **engine:** brand card codes as CardCode ([dd595af](https://github.com/macandy13/arkham-companion/commit/dd595afad257b08a4b8cad6613c056e24b32c74c))
* **engine:** brand encounter set codes, scenario and campaign definition IDs ([b51e2e5](https://github.com/macandy13/arkham-companion/commit/b51e2e5348e174aad177bb3e5ce06d1f74452890))
* **engine:** brand encounter set codes, scenario and campaign definition IDs ([27761a3](https://github.com/macandy13/arkham-companion/commit/27761a331c5647cc4ff0b3f9e43a1f0a6d7d49ab))
* **engine:** brand game and campaign IDs ([5edf3eb](https://github.com/macandy13/arkham-companion/commit/5edf3eb3659b9438009a220fc314d1ea7f246a06))
* **engine:** brand game and campaign IDs ([24657d8](https://github.com/macandy13/arkham-companion/commit/24657d8f59f6bf87d66ab95a06edc2144334af66))
* **engine:** brand investigator card codes as InvestigatorCode ([5d4878f](https://github.com/macandy13/arkham-companion/commit/5d4878fc268ee93820de5d2348eeeccfea0dc97f))
* **engine:** brand investigator card codes as InvestigatorCode ([bad6215](https://github.com/macandy13/arkham-companion/commit/bad621595244cfe585a581addb828bac3f826d5a))
* **engine:** compileSetup takes the scenario from the context ([8df3478](https://github.com/macandy13/arkham-companion/commit/8df34788e20271bd578a91ba3555d07548dc3449))
* **engine:** compileSetup takes the scenario from the context ([66113a0](https://github.com/macandy13/arkham-companion/commit/66113a005fd08903abcbc53e1aaa15eb95e6ba8c))
* **engine:** export campaign functions through a campaign namespace ([1227f91](https://github.com/macandy13/arkham-companion/commit/1227f9160dcb28b949e1f7475ca84bae0957f434))
* **engine:** keep interlude IDs unbranded and widen the ScenarioId doc ([1856840](https://github.com/macandy13/arkham-companion/commit/1856840220140f9dc808e0523f2c2e019d68982a))
* **engine:** keep investigator cards in the CardDb ([e4b9ee1](https://github.com/macandy13/arkham-companion/commit/e4b9ee1b2f7ac36d6e9d71a5b45c9c1b0b29f35d))
* **engine:** look up campaign investigators by code in a CampaignContext ([4603561](https://github.com/macandy13/arkham-companion/commit/46035610809286a9b0f14c97464560284dd50345))
* **engine:** look up campaign investigators by code in a CampaignContext ([3d8c8a7](https://github.com/macandy13/arkham-companion/commit/3d8c8a7a6eef90832861528faaac4444e5c7d7be))
* **engine:** name campaign team members and record the played-scenarios follow-up ([e397d35](https://github.com/macandy13/arkham-companion/commit/e397d35ff7b8cc61cdee6d81c76c83e48fb1e9bd))
* **engine:** name the campaign correction command AdjustCampaign ([29d55d6](https://github.com/macandy13/arkham-companion/commit/29d55d6d6d2ee7dce42a3dd547c30d6b83c62782))
* **engine:** one keywordAttackCommands for retaliate and alert; review fixes ([10d6302](https://github.com/macandy13/arkham-companion/commit/10d63025e9ef258dd3c280d5035c7e87ad35d438))
* **engine:** one spec per command for handler and pipeline policies ([4a75f75](https://github.com/macandy13/arkham-companion/commit/4a75f75c09508729f323767389d0a1f388faa402))
* **engine:** one spec per command for handler and pipeline policies ([1f14c26](https://github.com/macandy13/arkham-companion/commit/1f14c260211bedf9b2ed0e2a7910b6a44ba8c49e))
* **engine:** pass the CampaignContext to every campaign handler ([9e74113](https://github.com/macandy13/arkham-companion/commit/9e74113ab2f57a785e0acb26b607e166b720d5ef))
* **engine:** reach campaign functions through a campaign namespace ([7803b85](https://github.com/macandy13/arkham-companion/commit/7803b850c24c31eeb6193d4e1175493220c3f69e))
* **engine:** reach scenario setup functions through a scenario namespace ([c714c7c](https://github.com/macandy13/arkham-companion/commit/c714c7c0d328390a0bf11ebadedc1a127b208826))
* **engine:** reach scenario setup functions through a scenario namespace ([bde87bd](https://github.com/macandy13/arkham-companion/commit/bde87bd457cea9ea5be6a0b2c2c157fad5644923))
* **engine:** read enemy and location cards via requireCard instead of an empty code ([84fe878](https://github.com/macandy13/arkham-companion/commit/84fe8784b97746a5b184cd6be7d4f76291c2d43e))
* **engine:** read hooks, reference and modifiers from the scenario in the context ([afc5145](https://github.com/macandy13/arkham-companion/commit/afc51459dadc0dac58c98d1947148b67db10d1c3))
* **engine:** read hooks, reference and modifiers from the scenario in the context ([e5616af](https://github.com/macandy13/arkham-companion/commit/e5616afcfb398ba3672c9b66d735afcc59174a58))
* **engine:** rename addTrauma to changeTrauma and drop a duplicated comment ([7e0442b](https://github.com/macandy13/arkham-companion/commit/7e0442b27859f9a1d5b9d8a1c5a4f7eb2a944093))
* **engine:** seat scenario investigators by code from an InvestigatorDb ([250c57c](https://github.com/macandy13/arkham-companion/commit/250c57c3d270a4fa1c11f65c2a2453de3a8fcfbd))
* **engine:** seat scenario investigators by code from an InvestigatorDb ([f6c98f2](https://github.com/macandy13/arkham-companion/commit/f6c98f25a0b0a375a55414f99cc12dd799e520cb))
* **engine:** share discardToTop, count the attachment limit by title ([b9d5bc5](https://github.com/macandy13/arkham-companion/commit/b9d5bc5874e9c46b45004d130ba21b389b27515e))
* **engine:** share isActiveInvestigator; name the lead in decider tests ([efd1ebe](https://github.com/macandy13/arkham-companion/commit/efd1ebe4ffc049ebf8d60eb9bcf65d0030245a8a))
* **engine:** use isNonNegativeInteger for the corrected position ([c43f675](https://github.com/macandy13/arkham-companion/commit/c43f675bda3779b071219f0c3f673866ee241f8d))
* **web:** build the routed game ID with the gameId constructor ([ebe1680](https://github.com/macandy13/arkham-companion/commit/ebe1680028d38d6a98b03c03251e0671cd96fd17))


### Documentation

* analyse Chapter Two encounter cards for special rules ([1f3a45c](https://github.com/macandy13/arkham-companion/commit/1f3a45cde1ff579d407cc7e24dbd5f8c7a223cc5))
* analyse Chapter Two encounter cards for special rules ([f54764d](https://github.com/macandy13/arkham-companion/commit/f54764d8ae90086178103b28abad05e12b9b56ac))
* cite the advanced timing entry by name ([52027aa](https://github.com/macandy13/arkham-companion/commit/52027aa1c3d7a8e7dc2b5cb677127b77a2925e68))
* correct keyword and blood token rules, link the plan from M4.5 ([64dc0c7](https://github.com/macandy13/arkham-companion/commit/64dc0c7ae293235fb64a10eca01f57b2e6140e2e))
* defer ordering simultaneous forced effects (M1.18) ([4293b9a](https://github.com/macandy13/arkham-companion/commit/4293b9a8e9f0753372e24fa19378c9e727880073))
* end-of-turn and end-of-round timings in rules and architecture ([89d7e5a](https://github.com/macandy13/arkham-companion/commit/89d7e5a13e364508df2436df85712bd61e884f48))
* **engine:** fix the article before AdjustCampaign ([c1adbf5](https://github.com/macandy13/arkham-companion/commit/c1adbf5b563c830bde63d12e07c212282740d84b))
* **engine:** note that the fixed scenario order is for linear campaigns ([61f4b87](https://github.com/macandy13/arkham-companion/commit/61f4b873941ba879dc9a637008a3e37bd05caf75))
* **engine:** restore why engaging provokes ([415a308](https://github.com/macandy13/arkham-companion/commit/415a308a7f2eeaa5dbfddb7ee4af035ad0da93d9))
* **engine:** say when skill test outcome triggers resolve ([415173e](https://github.com/macandy13/arkham-companion/commit/415173e27c2cca39dfe2ec12200bc0086d5075db))
* keep PR descriptions free of who-asked attributions ([557299d](https://github.com/macandy13/arkham-companion/commit/557299d30d38ceb4daede5c4d584f0a574314cfe))
* keep PR descriptions free of who-asked attributions ([b3f6d0e](https://github.com/macandy13/arkham-companion/commit/b3f6d0ee4839e80c28246883878093124efc5525))
* list the refactoring follow-ups from the campaign review ([b44add5](https://github.com/macandy13/arkham-companion/commit/b44add5add437b3bed2f92e0088665207665494a))
* move the finished M1C.1 task to docs/tasks/done ([462b900](https://github.com/macandy13/arkham-companion/commit/462b900b26ee49dbb0367593a5e34e14456216a1))
* move the finished M1C.1 task to docs/tasks/done ([ee3a4bd](https://github.com/macandy13/arkham-companion/commit/ee3a4bd7e19ef93cbcf8a463b4665774ac1e2aab))
* name AdjustCampaign in the M1C.1 slices ([2f34161](https://github.com/macandy13/arkham-companion/commit/2f341613fc5631830959e8d91e4c6176438d7f4c))
* name ScenarioContext in the architecture overview ([745d861](https://github.com/macandy13/arkham-companion/commit/745d8617e83ee90894c82b5fcca895052cccd1cf))
* note one CardDb for all cached cards as an M4.4 follow-up ([9350f24](https://github.com/macandy13/arkham-companion/commit/9350f246eab00fcd4b89a6a50aada0d1ed67db08))
* note one CardDb for all cached cards as an M4.4 follow-up ([714cd1d](https://github.com/macandy13/arkham-companion/commit/714cd1d8ed72e72e340767021f5db35a63f065c4))
* placement without a drawer in Command handling ([a423212](https://github.com/macandy13/arkham-companion/commit/a423212005d8bf51f47ef1746cc73e9e48c112f1))
* prefer strong types for domain values ([ab4ae12](https://github.com/macandy13/arkham-companion/commit/ab4ae129c85d95d40191c8cba07943c62153e258))
* prefer strong types for domain values ([1cb4d94](https://github.com/macandy13/arkham-companion/commit/1cb4d9427a31370238fccfe09dc147bc3d9a4e18))
* rebuilding the context for a saved game is M3.1 work ([38fcd2f](https://github.com/macandy13/arkham-companion/commit/38fcd2f334561c0f9fd0e9d09a199970a98d9855))
* record forced-effect timing and the M1V.1 findings ([a18ac2e](https://github.com/macandy13/arkham-companion/commit/a18ac2eabfbc61c31a8e67a7fc530d0202177c0a))
* use bullet lists in the encounter card analysis ([f9593f8](https://github.com/macandy13/arkham-companion/commit/f9593f8e4a8a47160f29e7088acae9836e71d6c0))

## 2026-10-16 (was 1.2.0)


### Features

* **engine:** add skill test modifiers with an explanation trace (M1.13) ([b8a198e](https://github.com/macandy13/arkham-companion/commit/b8a198ef26a4622c31b2b8270c0ed375088b3393))
* **engine:** investigator defeat clean-up and resign (M1.15) ([44a8923](https://github.com/macandy13/arkham-companion/commit/44a8923072c51e9d3a6503d3541a90aff4245c43))


### Refactoring

* **engine:** share event building blocks (M1.19) ([494b4cd](https://github.com/macandy13/arkham-companion/commit/494b4cdc2e4d47209bf4b84c7bcdb42e57a6c7c4))
* **engine:** share event building blocks (M1.19) ([8347181](https://github.com/macandy13/arkham-companion/commit/83471814e16338cf64a47aa3bc99a52358f284af))


### Documentation

* add a review map to the PR template, REVIEW.md and collapsed plumbing ([1a25165](https://github.com/macandy13/arkham-companion/commit/1a25165d6e2479e3d32b78a3a70abfd114dabe0e))
* add size and splitting rules for small, reviewable PRs ([#51](https://github.com/macandy13/arkham-companion/issues/51)) ([7bc5f5a](https://github.com/macandy13/arkham-companion/commit/7bc5f5a2e9ce38501f59fd12a9d8531f2767cf4a))
* architecture as current state, product as plan ([8a76a37](https://github.com/macandy13/arkham-companion/commit/8a76a37b529493d1e545f5c901550df566461ea1))
* architecture as current state, product as plan (review) ([e791565](https://github.com/macandy13/arkham-companion/commit/e7915657c88a8a44701e03b32e54c9d31c686649))
* inline code links with full paths in architecture.md ([1ec426c](https://github.com/macandy13/arkham-companion/commit/1ec426c4d10bcdbe31a4e44b82584e08958d6b84))
* mention the ESLint ground rules from [#56](https://github.com/macandy13/arkham-companion/issues/56) in the architecture ([f4bfee1](https://github.com/macandy13/arkham-companion/commit/f4bfee15315f2ddbdfdedd624aaaba6f5570edf6))
* restructure architecture into overview and pieces ([b0e0b37](https://github.com/macandy13/arkham-companion/commit/b0e0b372088930e9ff1f186df65bc74ff68383b0))
* rules claims table from rules-checker and a playthrough step for every rule ([85a2004](https://github.com/macandy13/arkham-companion/commit/85a200402e0d1d1ce3847d4d0742fc61dd4792db))
* show functions where explained, add rules verification milestone ([c1b708c](https://github.com/macandy13/arkham-companion/commit/c1b708cb788e97cfba79a44121df303800da3b7d))

## 2026-10-16 (was 1.1.0)


### Features

* **carddata:** add investigator catalog (M2.2) ([2177043](https://github.com/macandy13/arkham-companion/commit/2177043b766eeabebfde19453412990bb2fb62f4))
* **engine:** add a human-readable board printer for debugging ([01b38e4](https://github.com/macandy13/arkham-companion/commit/01b38e4c446b599a5a61fd4b5bfff08f2474232e))
* **engine:** add agenda, act and doom (M1.5) ([cb4cb95](https://github.com/macandy13/arkham-companion/commit/cb4cb95ad67c4b681a61c3b7cac5806c1b6b0c59))
* **engine:** add agenda, act and doom (M1.5) ([f4c6172](https://github.com/macandy13/arkham-companion/commit/f4c6172c4baa11fc48d4e3f7d935fe09a4169d48))
* **engine:** add board connection graph (M1.3) ([d8af7d7](https://github.com/macandy13/arkham-companion/commit/d8af7d702048bbe7185eb39142287643fe8c7e2c))
* **engine:** add board connection graph (M1.3) ([fb073c4](https://github.com/macandy13/arkham-companion/commit/fb073c4f60b2b4157bb330d550ca40b729899b36))
* **engine:** add CardDb context (M1.1) ([910ec97](https://github.com/macandy13/arkham-companion/commit/910ec9705af1047cac5757bcc21ef212e8f6768e))
* **engine:** add command-grouped undo (M1.11) ([d468476](https://github.com/macandy13/arkham-companion/commit/d468476d5d924a3ae51f7bb16780297f1e5a05b7))
* **engine:** add command-grouped undo (M1.11) ([d2c95d8](https://github.com/macandy13/arkham-companion/commit/d2c95d89936e649cb59bda1393bb6259de713bdb))
* **engine:** add encounter deck and keyword parser (M1.7) ([4623579](https://github.com/macandy13/arkham-companion/commit/4623579fe69a739c354e80d94714aebabf852807))
* **engine:** add encounter deck and keyword parser (M1.7) ([8c21091](https://github.com/macandy13/arkham-companion/commit/8c210918f4608539d419aad408e6611c71d183ea))
* **engine:** add enemies, engagement and hunter movement (M1.8) ([513b84c](https://github.com/macandy13/arkham-companion/commit/513b84cc94faec0e249ab23132ba0a029760643c))
* **engine:** add enemies, engagement and hunter movement (M1.8) ([c695d4c](https://github.com/macandy13/arkham-companion/commit/c695d4caac46014f68329e1fc144f849b8866018))
* **engine:** add generic decisions (M1.9) ([ab3b51a](https://github.com/macandy13/arkham-companion/commit/ab3b51a68f564351e8171148afc0d8f9fda96688))
* **engine:** add generic decisions (M1.9) ([785f22d](https://github.com/macandy13/arkham-companion/commit/785f22d68196c4d6137d7ffb5df807bcfcc4bcfa))
* **engine:** add investigator commands and defeat check (M1.4) ([78e7ae7](https://github.com/macandy13/arkham-companion/commit/78e7ae7f21922073e255443f9fc258922a43f561))
* **engine:** add investigator commands and defeat check (M1.4) ([84160b1](https://github.com/macandy13/arkham-companion/commit/84160b1edb9549a27250a01561cb2430976bb6ec))
* **engine:** add phase assistant and skill test hand-off (M1.10) ([36e15c5](https://github.com/macandy13/arkham-companion/commit/36e15c5a331d279b2fdfaec31c06b6d5d1578b52))
* **engine:** add phase assistant, turns and skill test hand-off (M1.10) ([2080553](https://github.com/macandy13/arkham-companion/commit/2080553a96f7344dfaa90f862702bf82d386bc0b))
* **engine:** add setup DSL and sandbox scenario (M1.2) ([b098088](https://github.com/macandy13/arkham-companion/commit/b098088500813801fac029b5ea49a9845b9a50f8))
* **engine:** add trigger bus and scenario hooks (M1.6) ([4186ee6](https://github.com/macandy13/arkham-companion/commit/4186ee68808bb0006699018b301147fc188ed8ca))
* **engine:** add trigger bus and scenario hooks (M1.6) ([a22ecbd](https://github.com/macandy13/arkham-companion/commit/a22ecbd914c06f7f72b1a1ad5de2f1f1fb411e3a))
* **engine:** attacks of opportunity as a confirm decision (M1.12) ([adeb446](https://github.com/macandy13/arkham-companion/commit/adeb4463aceeefc7069ce0ab684531af596e3a7f))
* **engine:** investigator turns with adjustable actions (M1.10) ([d419563](https://github.com/macandy13/arkham-companion/commit/d419563d841ace231c1cb02e43f0a3458fb57685))
* **engine:** revelation tests and confirmed skill-test results (M1.10) ([04479fe](https://github.com/macandy13/arkham-companion/commit/04479fee6c64e4ffe338e070319594208b3340c7))
* **scenarios:** resolve The Gathering act 1 via onActAdvance (M1.6) ([b556267](https://github.com/macandy13/arkham-companion/commit/b5562677f76cbe5c009b376d7f95a7edce303813))
* **web:** add game export and import (M2.7) ([#22](https://github.com/macandy13/arkham-companion/issues/22)) ([78180d2](https://github.com/macandy13/arkham-companion/commit/78180d255741349b5b8fe7906cb0f4ca7b32ba10))
* **web:** add hash routing and screen skeleton (M2.1) ([be04bfa](https://github.com/macandy13/arkham-companion/commit/be04bfa646d9445da4fdd0381424be18deda4e9b))
* **web:** add home screen with saved games (M2.6) ([#20](https://github.com/macandy13/arkham-companion/issues/20)) ([35377f8](https://github.com/macandy13/arkham-companion/commit/35377f86de5ea17191f7cb4ce049263575309764))
* **web:** add investigator picker (M2.3) ([#17](https://github.com/macandy13/arkham-companion/issues/17)) ([a6fb631](https://github.com/macandy13/arkham-companion/commit/a6fb631dc488da27558e7a65efaf95e54f6ea7bc))
* **web:** add new game wizard (M2.5) ([#36](https://github.com/macandy13/arkham-companion/issues/36)) ([238a75e](https://github.com/macandy13/arkham-companion/commit/238a75e0b8a46936f65ba171ab2daf85276f3a8d))


### Bug fixes

* **carddata:** parse keyword details without backtracking ([3318113](https://github.com/macandy13/arkham-companion/commit/33181132a688af25d287cbc8156ad374c3b848ec))
* **carddata:** strip card markup in linear time ([d5638be](https://github.com/macandy13/arkham-companion/commit/d5638bef236e0e4638034e256626af7bb5cd1710))
* **carddata:** strip card-text markup until stable (M1.7) ([42ef17a](https://github.com/macandy13/arkham-companion/commit/42ef17a5cc1016835cc22b2756595c4405de186d))
* **carddata:** strip trait markup in linear time ([d163263](https://github.com/macandy13/arkham-companion/commit/d163263de61f0b5862d264289c38c801ab180742))
* **engine:** attack in player order and redirect failed fight damage (M1.10) ([84403d7](https://github.com/macandy13/arkham-companion/commit/84403d7d8b6e0fe98aec9e2ba5824389e4ef6807))
* **engine:** attacks of opportunity resolve before the action (M1.12) ([de38997](https://github.com/macandy13/arkham-companion/commit/de389970cce3726e2f56ca1674bc7746976d2af0))
* **engine:** no attacks on unengaged aloof enemies, no engaging massive ones (M1.10) ([a44be21](https://github.com/macandy13/arkham-companion/commit/a44be218cb0ccb1143a2be141c065ddffa21cce2))
* **engine:** reshuffle empty encounter deck immediately; victory from card data (M1.7) ([3298d7d](https://github.com/macandy13/arkham-companion/commit/3298d7d883b2b9ac7711e70e2ad2d846eec3e077))
* **engine:** resolve agenda/act reverse side before the next card (M1.6) ([adf323d](https://github.com/macandy13/arkham-companion/commit/adf323d4ac55725cda2b85818de2022449069dd5))
* **engine:** resolve revelations before discarding (M1.10) ([415e100](https://github.com/macandy13/arkham-companion/commit/415e1002a1ec638c72f97f054d2d20dfcceafe50))
* **engine:** spawn engages the drawer; no silent spawn fallback (M1.8) ([359f2e6](https://github.com/macandy13/arkham-companion/commit/359f2e643da9d77dbf4411a7a78e8e67ba8a8dff))
* **scenarios:** correct Gathering keywords and set code ([3a68390](https://github.com/macandy13/arkham-companion/commit/3a68390b36bee8d0014b07cb633f160c77e5ba53))
* **web:** only serve the app shell for the app root, not every navigation ([c191182](https://github.com/macandy13/arkham-companion/commit/c19118211a40faeb6319cfe8cf29f608bb0fd658))
* **web:** only serve the app shell for the app root, not every navigation ([b159be3](https://github.com/macandy13/arkham-companion/commit/b159be304f07213c46e93302cb6d947b775dc8cf))


### Refactoring

* **carddata:** use plain interfaces for card types, zod only for raw ArkhamDB input ([c7f1ee7](https://github.com/macandy13/arkham-companion/commit/c7f1ee738f4441a38b0ffae2027423267bdbe8be))
* **carddata:** use plain interfaces for card types, zod only for raw ArkhamDB input ([e0be85d](https://github.com/macandy13/arkham-companion/commit/e0be85d536e9aa26ec67c04fcb724d4b506a131f))
* **engine:** address M1.2 review – map model, typed steps, Gathering scenario (M1.2) ([ccd6f74](https://github.com/macandy13/arkham-companion/commit/ccd6f746697e6791fb9908d8e1932e8670e38f74))
* **engine:** address M1.3 review ([20d52bd](https://github.com/macandy13/arkham-companion/commit/20d52bd8cae47291223320d21e745fda5896eca2))
* **engine:** address M1.4 review – readable test ids, shared helpers, underscore filenames ([fadf265](https://github.com/macandy13/arkham-companion/commit/fadf2654b171f48534b384d9e55ca9730528e9ca))
* **engine:** address M1.5 review – optional clue payment, undefined thresholds, shared helper ([8bff3cf](https://github.com/macandy13/arkham-companion/commit/8bff3cf85de1fa8a657e8dbb002e924a430140fe))
* **engine:** address M1.8 review – stripTrailingDot, hunter order decision, shared card lookups ([9c6df6e](https://github.com/macandy13/arkham-companion/commit/9c6df6ea1730fa49318bee7d4410cb4255fa9705))
* **engine:** adopt base changes (M1.11) ([7111f2b](https://github.com/macandy13/arkham-companion/commit/7111f2b708781059e7e00f11f046a2018133232c))
* **engine:** adopt base changes and rules (M1.10) ([78705af](https://github.com/macandy13/arkham-companion/commit/78705af4591085d9b1d088ad67243c92644ca80f))
* **engine:** adopt M1.1 card stats API ([d5ab35e](https://github.com/macandy13/arkham-companion/commit/d5ab35ed0faf7943d3fba29d366be0a552b5fc83))
* **engine:** adopt M1.1 card stats API ([7a3ad95](https://github.com/macandy13/arkham-companion/commit/7a3ad95ce5a9c44e50b245e99a5f98e4787897d5))
* **engine:** adopt M1.7 review changes, helpers and test rule (M1.8) ([eebfeda](https://github.com/macandy13/arkham-companion/commit/eebfedac0cf4e2cc1128729a9b2d90537a14e37d))
* **engine:** adopt main's helpers and underscore filenames (M1.6) ([91b219f](https://github.com/macandy13/arkham-companion/commit/91b219feb0023220e4e71daa687692568f83ec91))
* **engine:** adopt main's helpers and underscore filenames (M1.7) ([234b565](https://github.com/macandy13/arkham-companion/commit/234b565e34c31c6a889d618e0d041e2e5b59c408))
* **engine:** adopt map model, test utils and table tests (M1.10) ([ad14d64](https://github.com/macandy13/arkham-companion/commit/ad14d64e136db0b9fa1c55cb6938b00b2d756c17))
* **engine:** adopt map model, test utils and table tests (M1.11) ([b5fbcc1](https://github.com/macandy13/arkham-companion/commit/b5fbcc1506a83d572fa698a2febf70ef1c05b0dd))
* **engine:** adopt map model, test utils and table tests (M1.4) ([41f7c77](https://github.com/macandy13/arkham-companion/commit/41f7c7717ae0cd92c1c0b95992ca9e1c82f32fb6))
* **engine:** adopt map model, test utils and table tests (M1.6) ([b65499c](https://github.com/macandy13/arkham-companion/commit/b65499c77aec851a15fab319efb0fe9141895c72))
* **engine:** adopt map model, test utils and table tests (M1.7) ([8349b67](https://github.com/macandy13/arkham-companion/commit/8349b6703b4aa5e57a39f7812850cc8f0e96ae3b))
* **engine:** adopt map model, test utils and table tests (M1.8) ([b3f74b3](https://github.com/macandy13/arkham-companion/commit/b3f74b304add57c501cfdfeba1d3fcba803cd7a2))
* **engine:** adopt underscore filenames and shared test helpers (M1.5) ([e445580](https://github.com/macandy13/arkham-companion/commit/e445580bcee39e614a0136a738493dfef9473cb3))
* **engine:** describe decisions in plain words with readable options (M1.9) ([50f6768](https://github.com/macandy13/arkham-companion/commit/50f676810b3332aac330b4f14052bc55cad128b5))
* **engine:** draw matched encounter cards through DrawEncounter (M1.7) ([7e2ae47](https://github.com/macandy13/arkham-companion/commit/7e2ae47a1fde1427a24cc8d03dd3cb531008861b))
* **engine:** golden playthrough on The Gathering (M1.12) ([912c0d4](https://github.com/macandy13/arkham-companion/commit/912c0d42627a5110a9bc5f2b20560ce2696f914b))
* **engine:** one adjustable action counter (M1.10) ([aa5ae8a](https://github.com/macandy13/arkham-companion/commit/aa5ae8a39dfbe92d9db13aea8d1b92d6d11d7adb))
* **engine:** players count actions, engine keeps a resettable counter (M1.10) ([dc2e958](https://github.com/macandy13/arkham-companion/commit/dc2e95801615782ced81bda4fe87fa1cdedaaf5d))
* **engine:** replace withHealth test helper with withStats (M1.4) ([95aa680](https://github.com/macandy13/arkham-companion/commit/95aa6802d5f3eefb6dbd11040cde9e32d09f7a9e))
* **engine:** unified map model and typed setup steps (M1.2) ([3660140](https://github.com/macandy13/arkham-companion/commit/36601401c8ae858ff8683888fe27ab7903dea741))


### Documentation

* add a rules summary and move finished tasks to docs/tasks/done ([#48](https://github.com/macandy13/arkham-companion/issues/48)) ([580b750](https://github.com/macandy13/arkham-companion/commit/580b7502a22b44c60d31a7a33ba5aa24a6c6317c))
* mark M1.12 done and reword it as the continued end-to-end test ([cbd1e0b](https://github.com/macandy13/arkham-companion/commit/cbd1e0ba90fd621a7296a1cb4d24715de58847ee))
* no property-based tests; options objects ([37f3326](https://github.com/macandy13/arkham-companion/commit/37f3326c48bef72b83c98881c216bc3e9fbf127b))
* plan M1 follow-up tasks M1.15–M1.18 ([bda03f9](https://github.com/macandy13/arkham-companion/commit/bda03f9e36fe49c078c301af2973fe27eb0082d3))
* plan M1 follow-up tasks M1.15–M1.18 ([9eb8f86](https://github.com/macandy13/arkham-companion/commit/9eb8f86c93d566a24a140d8ec4851f35e9343524))
* plan the campaign engine milestone (M1C) ([#44](https://github.com/macandy13/arkham-companion/issues/44)) ([44f8687](https://github.com/macandy13/arkham-companion/commit/44f8687d101e0a7fcd51c156f6c47f139e4adedc))

## 2026-10-14 (was 1.0.0)


### Documentation

* explain the why and benefit of every milestone and task ([cf4cd2c](https://github.com/macandy13/arkham-companion/commit/cf4cd2c7c57156da7034ac86c4438de43d17f7c1))
* require PR descriptions to start with a motivation ([8d91c3e](https://github.com/macandy13/arkham-companion/commit/8d91c3e551f83ef409a62261385311e62fa8d310))
* require PR descriptions to start with a motivation ([b426870](https://github.com/macandy13/arkham-companion/commit/b426870a1a21f1ca0f26c1099e01746a6318abb2))

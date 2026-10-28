# Skill tests

[Skill test timing](https://arkhamdb.com/rules#Skill_Test_Timing), [difficulty](https://arkhamdb.com/rules#Difficulty_skill_tests), [chaos tokens](https://arkhamdb.com/rules#Chaos_Tokens), [automatic failure/success](https://arkhamdb.com/rules#Automatic_Failure_Success).
Card rulings: [Resolution order](cards/resolution-order.md), [Children of Blood](cards/children-of-blood.md).

1. Determine the skill (willpower, intellect, combat or agility). Difficulty is the fight value, shroud, evade value, or the number in parentheses on the card, each with its active modifiers (Obscuring Fog's +2 shroud).
2. Commit cards: the tester commits any number, and each other investigator at the same location commits up to one. Each matching or wild icon gives +1.
3. Reveal a chaos token.
4. Resolve its symbol:
   - skull, cultist, tablet and elder thing use the scenario reference card,
   - elder sign uses the tester's investigator card,
   - and auto-fail fails the test.
5. Modified skill = base skill plus icons, the token's modifier and active effects.
6. Success if the skill is at or above the difficulty.
   - Auto-fail sets the skill to 0, and auto-success sets the difficulty to 0.
   - Reactions and forced effects on "succeeded/failed" trigger here.
7. Apply results in an order the tester chooses (clue discovered, damage dealt, card effects), including "if this test succeeds/fails" effects.
   - "After you succeed/fail" abilities are not results: they trigger in step 6, before these (Rules Reference, "Skill Test Results and Advanced Timing").
   - That includes "after you successfully investigate" and "after attached location is successfully investigated" (Obscuring Fog is discarded before the clue is discovered).
8. Discard committed cards and return the tokens to the bag.

Bless (+2), curse (-2), frost (-1) and the blood token (-1) each make the tester reveal another token, whose modifier also applies.

## Margin of success and failure

A test [succeeds by](https://arkhamdb.com/rules#Skill_Test_Timing) the modified skill minus the difficulty ("succeed by 2 or more") and fails by the difficulty minus the modified skill; after an [auto-fail](https://arkhamdb.com/rules#Automatic_Failure_Success), whose skill is 0, that is the whole difficulty.

- "For each point you fail by" scales with it (Grasping Hands: 1 damage per point), so a fail by 0 (an auto-fail against difficulty 0) deals nothing.
- False Lead's "place 1 of your clues on your location" for each point places as many as the investigator has when they have fewer ([golden rules](https://arkhamdb.com/rules#Golden_Rules): resolve as much as possible).
- The players confirm the margin with their answer.

## Results that defeat the tester

When a fail's first part defeats the tester, its later parts that concern them are skipped, since a defeated investigator is out of play, and parts that concern others still happen (resolve as much as possible).
A card's unconditional text after the test ("Then, …") still resolves whether the test passed or failed, but not for a tester the fail defeated ([Resolution order](cards/resolution-order.md)).

Horror and damage from one effect ("take 1 horror and 1 damage") are placed [simultaneously](https://arkhamdb.com/rules#Dealing_Damage_Horror), so both land even when either defeats.
Defeated by both at once, the investigator chooses which trauma to suffer ([Trauma](https://arkhamdb.com/rules#Trauma)) (see [Campaign](campaign.md)).

## Step notes

If auto-success or auto-failure is known before step 3, skip steps 3 and 4.
[Variable difficulty](https://arkhamdb.com/rules#Variable_Difficulty_Skill_Tests) is fixed once step 6 checks it.

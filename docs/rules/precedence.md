# Precedence

- [Golden rules](https://arkhamdb.com/rules#The_Golden_Rules): card text beats the Rules Reference, which beats Learn to Play.
- [Grim rule](https://arkhamdb.com/rules#The_Grim_Rule): if a rules question can't be answered, resolve it in the way worst for the investigators. This is a table fallback, not something the engine models.
- [Choices](https://arkhamdb.com/rules#Choices_and_the_Grim_Rule), [lead investigator](https://arkhamdb.com/rules#Lead_Investigator): when the group must choose between valid options (ties for hunter movement, prey, spawn location, order of simultaneous forced effects), the lead investigator decides.
  - The app turns each such choice into a `Decision`.
  - If the lead investigator is eliminated, the remaining players pick a new one.
- [Simultaneous resolution](https://arkhamdb.com/rules#Priority_of_Simultaneous_Resolution): individual choices for an effect that hits several players are made in player order, then the effect applies to all at once. The lead investigator orders forced abilities and lasting effects that would resolve at the same time.

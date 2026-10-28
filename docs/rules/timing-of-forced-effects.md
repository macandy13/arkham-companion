# Timing of forced effects

[Forced abilities](https://arkhamdb.com/rules#Forced_Abilities), [At](https://arkhamdb.com/rules#At), [Effects](https://arkhamdb.com/rules#Effects), [FAQ v2.5](https://images-cdn.fantasyflightgames.com/filer_public/c1/d0/c1d0fab6-7fa6-4ce2-af6a-16416381a19b/ahc_faq_v25_february_2026-web.pdf) §1.4 (nested sequences).

- Each triggering condition runs "when" → the condition resolves → "after".
  - A forced "When…" starts before the condition takes effect; a forced "After…" starts once its effect has fully resolved.
  - "At …" and "If …" abilities (also "at the end of the turn/round") resolve between the two.
- Every part of an effect resolves before the "after" triggers it causes. So an engine command that is one effect may run its "after" abilities once all its events are done.
- Forced abilities on a timing point resolve before reactions to it.
- A forced ability that causes a new trigger opens a nested sequence. It finishes, choices included, before the sequence it interrupted goes on (last in, first out).
- Once an ability starts, as much of it as possible resolves, in order, before the next one starts ([Triggered Abilities](https://arkhamdb.com/rules#Triggered_Abilities)).
  - A choice that is part of an effect is part of that effect, so it comes before "after" triggers on it.
  - The one exception is a skill test: "after you succeed/fail" triggers in step 6, before the results (FAQ v2.5 §1.7).
- A [Revelation](https://arkhamdb.com/rules#Revelation_Abilities) starts as the card is drawn: before an enemy spawns and before a treachery is placed or discarded.
- Forced abilities that resolve at the same time are ordered by the lead investigator (see [Precedence](precedence.md)).

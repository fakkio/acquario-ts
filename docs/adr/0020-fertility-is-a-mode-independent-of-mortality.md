# Fertility is a mode independent of mortality

`createWorld(seed, { mortality, fertility })`, with `fertility: "on" | "off"` defaulting to `"on"` from M4 — a string union for the same reason `mortality` is one, so no call site ever reads `sterile: false` and has to work out the double negative. `"off"` is not sterility as a trait: no organism in such a world evaluates mitosis at all, the same way `mortality: "off"` never lets an organism reach the death predicate.

## Why a mode of its own, rather than folding into mortality

Mortality and fertility are two different mechanisms: one is a floor under energy (or the absence of one), the other is a step in the resolve phase. Collapsing them into a single flag would mean `mortality` silently controlling something that is not mortality — precisely what ADR-0017 wrote a whole document to avoid when it separated death evaluation from the deposit.

It also gives M3's existing suite a home that needs no code changes to its own logic: those tests want **death without birth**, and that combination exists only if the two flags are independent. Every `createWorld` call in `world.test.ts`'s "mortality mode (M3)" block now says `fertility: "off"` explicitly, so the block goes on meaning exactly what it meant before this ticket — a mortal or immortal world with no reproduction in it at all.

Like `mortality`, `fertility` does **not** enter `hashState`. A hash identifies a state, not the law that produced it, and two worlds of different fertility mode at tick 0 are the same state — they only diverge once a tick evaluates mitosis for the first time. Folding it in would invalidate every hash recorded before this ticket, for nothing.

## Amending ADR-0015: the fixed-population world needs both flags off

ADR-0015 measures `α` in "a fixed, immortal population with no reproduction and no selection." The moment mitosis exists, `mortality: "off"` alone stops delivering that world: the population would grow, lineages with a lucky address would out-breed the rest, and selection would be back in the one world whose entire purpose is not having any.

`conservation.long.test.ts` — M2's own 100k-tick gate — gains `fertility: "off"` alongside its existing `mortality: "off"`, and changes by exactly that one argument. Its fixed-cohort assertions about zero-energy and at-cap counts go on meaning what they meant, running in a world with no birth code in it at all, regardless of what M4 makes the default everywhere else.

`GLOSSARY.md` gains **Fixed Population** — a world built with both modes off, ADR-0015's real instrument — and **Immortal World** is corrected to point at it: "immortal" was never sufficient on its own once a population could grow.

## Considered options

**A three-state `mortality: "on" | "off" | "fixed"`** that also disables reproduction. Rejected: it is the single-flag design this ADR exists to avoid, wearing a third value instead of a boolean — `mortality` would still be doing fertility's job, just with an extra label on it.

**Defaulting `fertility` to `"off"`** and requiring an explicit opt-in to reproduction. Rejected: M4's whole point is that a population can grow for the first time in the project's history, and `docs/vision.md`'s milestone table already names M4 by that capability. A default that hides it behind a flag nobody passes would make the milestone's own acceptance run reach for an option that should not need reaching for.

## Consequences

- `WorldOptions` gains `fertility?: FertilityMode`, alongside the existing `mortality?: MortalityMode`, both optional and independently defaulted.
- `runTick`'s step 7 is skipped entirely — not evaluated and discarded — when `fertility === "off"`, the same shape step 8 already takes for `mortality === "off"`.
- `GLOSSARY.md` gains **Fertility** and **Pending Birth** (ADR-0019's record), and corrects **Immortal World** to describe half of ADR-0015's instrument rather than all of it.

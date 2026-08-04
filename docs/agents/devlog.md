# Dev-log

A public dev-log in Italian, one article per milestone, living in `docs/devlog/00N-<slug>.md`.

It is written from a **fragment pile** that accumulates during implementation, not reconstructed from the diff at the end. The diff records what changed; it does not record what was surprising, what was thrown away, or why a choice was hard.

## Capture fragments as you go

`/implement` clears context between tickets. A noticing that isn't written to disk is gone by the next session — so it has to land in a file the moment it happens.

The pile for the milestone in progress lives at `docs/devlog/fragments/00N-<slug>.md`, and is committed alongside the code.

### When to offer

When a **notable choice** lands — one made by the agent, by Fabio, or jointly — offer to capture it:

> _This feels like dev-log material. Shall I run `/writing-fragments` on `docs/devlog/fragments/002-bodies-and-motion.md`?_

Then stop and wait. Never start the skill unasked, and never write to the pile directly — `/writing-fragments` is a grilling session whose whole value is the material it pulls out of Fabio. An agent silently appending its own summary produces the pile's worst possible content.

A choice is notable when at least one of these holds:

- **It could have gone the other way.** A real alternative was considered and rejected for a reason worth stating.
- **The naive version would have been wrong, and wrong invisibly.** Especially where a bug would have looked like working behaviour — the recurring theme of this project.
- **It surprised someone.** A closed-form result, a profile that contradicted the guess, a test that failed for an interesting reason.
- **It was funny, or a dead end.** Dead ends are good dev-log material and terrible ADR material.

If the choice is also **hard to reverse**, it wants an ADR *as well* — the two are not substitutes. An ADR records the decision for future engineers; a fragment records the story for readers. Write the ADR via `/domain-modeling`, offer the fragment separately.

### When not to offer

Routine implementation, style, and naming choices. Anything already fully stated in an ADR or in `vision.md` — the pile is for what those documents don't hold. If offering would interrupt a red-green cycle, wait until the cycle closes.

Offering twice in one ticket is almost always too often.

## Shaping the article

The dev-log is also where Fabio is deliberately learning to write. The teaching workspace lives at `C:\Users\Fabio\Dropbox\Obsidian Vault\scrivere-blog` — its `NOTES.md` holds the current rung of the ladder below.

**Fabio's hands go first, on every stage.** He cannot unread a generated draft: once he has seen one, whatever he would have written himself is gone. So his share is written **blind** — before any prose is generated for that milestone.

At the end of a milestone, on the milestone branch and **before the merge to `develop`**:

1. **Fabio writes his share, by hand, from the pile.** How much is set by the ladder in the workspace's `NOTES.md` — for M0, the load-bearing claim plus the opening beat. Never write it for him, never show him a version of it, never offer to. If he asks for help, help him *judge* what he has written — do not supply prose.
2. `/writing-beats` (or `/writing-shape`) fills the rest, treating his paragraphs as **fixed**. Fit around them; don't rewrite them.
3. **Commit the draft** with `📝(devlog): draft`, before editing. This is what makes the next step a diff instead of an overwrite.
4. `/edit-article` on the committed draft.
5. Commit with `📝(devlog):`, then merge.

Step 3 is not bookkeeping. The diff `/edit-article` produces over Fabio's own paragraphs is the highest-value feedback in the whole exercise — skipping the commit destroys it silently.

Leftover fragments that don't make the article stay in the pile. That is expected — the pile is meant to hold more material than the article needs.

## Language

Italian, per the exception recorded in `CONTEXT.md`. Domain terms stay in their English glossary form.
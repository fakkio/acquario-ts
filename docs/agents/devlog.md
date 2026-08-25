# Dev-log

A public dev-log in Italian, one article per milestone, living in `docs/devlog/00N-<slug>.md`.

It is written from a **fragment pile** that accumulates during implementation, not reconstructed from the diff at the end. The diff records what changed; it does not record what was surprising, what was thrown away, or why a choice was hard.

## Front matter

Every article opens with YAML front matter — the de-facto convention across Jekyll, Hugo, Astro and Eleventy, so the files stay portable if the dev-log ever becomes a blog.

```yaml
---
title: "Venticinque anni per cancellare una sottoclasse"
description: "Riscrivo in TypeScript un acquario in C# di venticinque anni fa. Quattro giri di brainstorming con due modelli: un design rigoroso, e tre bug che nessun test boccia."
date: 2026-08-07
authors:
  - Fabio Lazzaroni
  - Claude
tags:
  - artificial-life
  - simulation
lang: it
---
```

- `title` — the article title, quoted. The `# ` heading stays in the body as well, since GitHub is the current renderer. Drop it only once a generator renders the title from front matter.
- `description` — one or two sentences, in Italian, quoted. This is the card text on an index page and the `<meta name="description">`, so keep it under ~160 characters: search results truncate past that. It is a hook, not a summary — it says what the article is _about_, and it may not repeat the title.
- `date` — publication date, `YYYY-MM-DD`. Never edited afterwards; add `updated:` alongside it if an article is ever revised post-publication.
- `authors` — a list, human first. `Claude` without a model version: the byline should not go stale every model release.
- `tags` — lowercase kebab-case, English, 4–6 per article. English because tags are domain terms, and domain terms stay in their glossary form even in Italian prose.
- `lang` — `it`, per the language exception below.

## Capture fragments as you go

`/implement` clears context between tickets. A noticing that isn't written to disk is gone by the next session — so it has to land in a file the moment it happens.

The pile for the milestone in progress lives at `docs/devlog/fragments/00N-<slug>.md`, and is committed alongside the code. If it does not exist yet, create it with a working slug at the first offer — a missing filename is never a reason to skip the checkpoint below.

### The checkpoint

**Every ticket ends by asking, out loud: _where did reality differ from the plan?_**

Ask it after the last test goes green and before the commit. Do not carry it as a standing intention to be exercised whenever something feels notable — M0 shipped with an empty pile precisely because there was no fixed moment at which the question had to be answered. It is a step, at a fixed point, and it gets an answer either way:

- Something differed → **offer** to capture it.
- Genuinely nothing differed → say so in one line, and move on.

Silence is not an acceptable answer to the checkpoint, because an unasked question is indistinguishable from a question answered "no".

The offer itself:

> _This feels like dev-log material. Shall I run `/writing-fragments` on `docs/devlog/fragments/002-m0-skeleton.md`?_

Then stop and wait. Never start the skill unasked, and never write to the pile directly — `/writing-fragments` is a grilling session whose whole value is the material it pulls out of Fabio. An agent silently appending its own summary produces the pile's worst possible content.

### What clears the bar

A choice is notable when at least one of these holds:

- **It could have gone the other way.** A real alternative was considered and rejected for a reason worth stating.
- **The naive version would have been wrong, and wrong invisibly.** Especially where a bug would have looked like working behaviour.
- **It surprised someone.** Anything that contradicted the guess.
- **It was funny, or a dead end.** Dead ends are good dev-log material and terrible ADR material.

**Calibrate on implementation, not on design.** The examples this project reaches for by instinct — a closed-form result, a conservation law that turned into the best bug detector in the codebase — come from the design phase and are unusually large. Measuring an ordinary milestone against them is how a milestone comes to feel like it contained nothing. Every one of these is from M0, and every one clears the bar:

- an approach built half-way and then abandoned (`ba708d0`, a `Document` injection dropped from `mountCanvas`)
- a decision made and then reversed (`3aa0d6c`, two buttons merged into one toggle)
- a fiddly setting flipped, with the whole repo reformatted behind it (`575dd59`, `b73edfa`)
- a dependency taken on for a use that has not arrived yet (`10b0685`, Playwright)
- scope widened mid-flight (`7c770d0`, touch support on pan and zoom)

None of them is momentous. All of them are a story: something was tried, something was learned, something changed.

If the choice is also **hard to reverse**, it wants an ADR _as well_ — the two are not substitutes. An ADR records the decision for future engineers; a fragment records the story for readers. Write the ADR via `/domain-modeling`, offer the fragment separately.

### When not to offer

When the work genuinely has no story behind it: the plan was made, the plan was followed, nothing was learned. Note that this is a claim about **this specific piece of work**, not about a category of work — "routine implementation" is where most of M0's lost material was, and excluding it by category is what lost it.

Anything already fully stated in an ADR or in `vision.md` — the pile is for what those documents don't hold. If offering would interrupt a red-green cycle, wait until the cycle closes.

Offering twice in one ticket is almost always too often. But a milestone that reaches its end with an empty pile is a **defect, not a neutral outcome** — surface it before the article is written. The fallback is a recovery session interrogating the commit log weeks later, which is a much worse substitute for having been there.

## Shaping the article

The dev-log is also where Fabio is deliberately learning to write. The teaching workspace lives at `C:\Users\Fabio\Dropbox\Obsidian Vault\scrivere-blog` — its `NOTES.md` holds the current rung of the ladder below.

**Fabio's hands go first, on every stage.** He cannot unread a generated draft: once he has seen one, whatever he would have written himself is gone. So his share is written **blind** — before any prose is generated for that milestone.

At the end of a milestone, on the milestone branch and **before the merge to `develop`**:

1. **Fabio writes his share, by hand, from the pile.** How much is set by the ladder in the workspace's `NOTES.md` — for M0, the load-bearing claim plus the opening beat. Never write it for him, never show him a version of it, never offer to. If he asks for help, help him _judge_ what he has written — do not supply prose.
2. **Fill the rest from the pile**, treating his paragraphs as **fixed** — fit around them, don't rewrite them. Today `/writing-beats` or `/writing-shape`, chosen as below.
3. **Commit the draft** with `📝(devlog): draft`, before editing. This is what makes the next step a diff instead of an overwrite.
4. **Editing pass over the committed draft**, this time free to rewrite his paragraphs. Today `/writing-shape`, with the committed article itself as the pile.
5. **Move the result over the committed path**, so the change lands as a diff on the same file rather than as a second file.
6. Commit with `📝(devlog):`, then merge.

Steps 3 and 5 are not bookkeeping. The diff the editing pass produces over Fabio's own paragraphs is the highest-value feedback in the whole exercise — skipping either one destroys it silently.

Step 5 exists because the writing skills treat their input as **read-only** and write to a separate file, where `/edit-article` used to revise in place. The feedback comes from git, not from the skill: commit the draft, produce the shaped version alongside, overwrite the committed path with it, and `git diff` shows exactly what a strong editor did to his prose.

Leftover fragments that don't make the article stay in the pile. That is expected — the pile is meant to hold more material than the article needs.

### Choosing between beats and shape

Both are _exploit_ skills over the same pile and both enforce grounding. They differ in what they put in front of you each turn.

- **`/writing-beats`** offers candidate **next moves** and asks which direction the piece goes. Use it when the milestone has a **narrative spine** — something happened, in an order, and the order is the point.
- **`/writing-shape`** offers candidate openings, then asks what the reader needs next and argues the **form of each block**: prose or list, table or repeated structure, callout or inline, quote or paraphrase. Use it when the spine is an **argument or a measurement**, and the piece is dense with formulas, code and comparisons.

Dev-log 001 was narrative and took beats. Later milestones will lean closer to argument — "conservation broke here, this is how I found it" — so expect shape to become the more common pick. Decide per article, not by default.

For step 4 use **shape** regardless: an editing pass is an argument about what each block is doing.

### Grounding is the part to take seriously

Before the first block, both skills settle **what the reader knows walking in**. Everything else must be introduced by a block before a later block can lean on it.

This is the decision that most affects whether an entry reads to someone outside the project. Assume a reader who knows programming and nothing about this simulation: `tick`, `pool`, `mitosis` and `r_opt` all need grounding, and an ADR is not something to name without explaining.

### If these skills move again

`writing-fragments`, `writing-beats` and `writing-shape` are **not referenced by the `ask-matt` map**, so they sit outside the maintained flow. `/edit-article` vanished in an upstream update with no warning, and these can too.

`/edit-article` has since resurfaced at `.agents/skills/edit-article`, but stays out of this flow: it's a generic, non-pedagogical clarity pass, not a substitute for `writing-shape`'s block-by-block argument in step 4. Reach for it directly on other docs — a README, an ADR — that don't carry the teaching goal above.

The steps above are therefore written as **jobs**, with skill names as the current implementation. If a name changes, fix the parenthetical and leave the convention alone.

## Cross-references

When an article contradicts, deepens, or otherwise builds on an earlier one, link forward to it by hand — an ordinary inline link, at the point in the prose where it matters.

Never link backward by hand: don't edit a published article to add a pointer to a later one. `date` is never edited after publication (see Front matter above), and a hand-added backlink drifts the moment the referencing article is renamed or rewritten. If the dev-log ever gets a rendering engine, generate "referenced by" backlinks from the forward links already in the articles — that keeps published articles untouched and the backlinks always in sync.

## Language

Italian, per the exception recorded in `CONTEXT.md`. Domain terms stay in their English glossary form.

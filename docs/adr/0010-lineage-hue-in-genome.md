# `lineageHue` is a gene, not a rendering annotation

Organisms carry a heritable `lineageHue` with no physiological effect, drifting slightly each generation and rendered as body hue. Brightness encodes the energy fraction and radius encodes `bodyRadius`.

## Why

In v0.1 there are no organelles, so the doc's composition-derived colour scheme ("green for chloroplasts, red for muscle") encodes nothing, and the screen would show a few hundred identical grey dots. The genuinely interesting quantity — which *lineages* are winning — would be invisible.

`lineageHue` is a **neutral marker locus**, the same instrument population geneticists use to track ancestry: selection cannot act on it, so it records descent and nothing else. Related organisms share a colour and drift apart slowly, so a clade sweeping the population appears as a wave of colour and coexisting strategies as stable patches. Brightness makes starvation waves and boom–bust cycles readable without opening the CSV.

## Considered options

Keeping the hue purely in the rendering layer, derived from an id. Rejected deliberately: putting it in the genome means v0.2 eyes will be able to perceive it.

## Consequences

- The moment eyes can see it, `lineageHue` **stops being neutral**. Mimicry, aposematism and kin recognition become evolvable, and colour becomes a signal that can lie.
- That leaves an open v0.2 question: how a heritable arbitrary marker reconciles with colour as honest signalling of body composition.
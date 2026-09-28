# Experiment: why an unprimed v0.1 world goes extinct (#40)

Throwaway branch `experiment/v0-1-extinction`, on top of `7970ee2` (brownian force ∝ √r, so D ∝ 1/r). Never merged. The decision it feeds is #41's.

## Verdict

**Neither tenancy nor the energetic margin. The mass gate, acting as a sieve on mutations at birth.**

- Ambient food starts below ρ by construction (`(1 − AMBIENT_CO2_SHARE)·s ≈ 0.4 × 1.74 ≈ 0.70`) and internal `C_food` stays at 0.65–0.77 ρ all run. Almost no body can afford a same-sized child (`food ≥ ρ·childArea` ⇔ `childArea/parentArea ≤ C_food/ρ`); energy is not binding (median energy at 98% of cap, most bodies above threshold).
- `evaluateMitosis` draws the mutation _before_ the mass check and, on rejection, retries next tick with a fresh draw. That is rejection sampling on the child's size: **≈100% of committed births have a smaller child, 0% a larger one, mean child/parent radius 0.94** (`sieve.ts`, seed 7, baseline and `c₀ = 4.68`).
- Each generation is ~6% smaller by construction until the population crosses the energetic minimum viable radius (≈0.84 at α_bright ≈ 8.3, c₀ = 6.24) and dies.
- **Freezing `bodyRadius`** (`DELTA_BODY_RADIUS=0`) removes the sieve: 5/5 survive 100k ticks, ~135 organisms, with the **lowest tenancy measured (0.60)**.
- **Pricing the largest possible child before drawing** (`WORST_CASE_BIRTH_GATE=1`: food and energy for `r·(1+δ)`) also removes it: 5/5 survive, and mean r **rises** 0.90 → 1.18 by 100k (per-seed last-10k 1.02–1.28), towards `r_opt = 1.5`. The first v0.1 world whose r moves by selection. Cost: ~45 organisms, 334 births in 100k ticks.

## Tenancy is not predictive

Metabolic levers push tenancy past ADR-0025's `≥ 5` (6.4–14.4) and still go extinct or collapse to r ≈ 0.1–0.2; the survivors with the lowest tenancy (0.35, 0.60) are the only ones whose r holds or rises.

## Confinement freezes, it does not cure

A floor at the band's edge (`CONFINE_DEPTH=10`, founders placed inside it) survives 5/5 in every combination, but as a static crowd: nobody leaves, nobody dies, carbon stays locked in bodies, internal food sits at 0.65 ρ, and nobody can pay a child's mass. ~320–450 births in 100k ticks, r frozen at ~0.77.

## Results

Five seeds (7–11), 100k ticks, unprimed, `n`/`r_max` from the income ladder (infertile fixed population, so the birth gate never enters it). Full table and trajectories: [`results/summary.md`](results/summary.md), raw per-seed JSON in `results/`.

| variant                   | survived | extinct at | births  | peak    | tenancy | mean r 1k → 100k (or last alive) | n         | r_max                   |
| ------------------------- | -------- | ---------- | ------- | ------- | ------- | -------------------------------- | --------- | ----------------------- |
| base                      | 0/5      | 14–23k     | 23.5k   | 1,072   | 3.9     | 0.80 → 0.18                      | 1.044     | 2.77                    |
| c₀ 4.68                   | 0/5      | 27–34k     | 93k     | 2,387   | 6.4     | 0.77 → 0.18                      | 1.158     | 2.90                    |
| c₀ 3.12                   | 2/5      | 71–85k     | 854k    | 6,365   | 9.3     | 0.76 → 0.10                      | 1.340     | 2.98                    |
| yield 1000                | 0/5      | 24–34k     | 70k     | 2,011   | 6.5     | 0.76 → 0.17                      | 1.107     | 3.15                    |
| yield 1200                | 0/5      | 36–81k     | 284k    | 3,143   | 7.5     | 0.76 → 0.16                      | 1.208     | —                       |
| yield 1600                | 5/5      | —          | 118k    | 3,011   | 1.9     | 0.75 → 0.21                      | 0.948     | —                       |
| K_PHOTO 0.04              | 0/5      | 26–41k     | 142k    | 2,446   | 7.5     | 0.76 → 0.16                      | 1.112     | —                       |
| K_PHOTO 0.06              | 5/5      | —          | 2.84M   | 6,007   | 14.4    | 0.77 → 0.12                      | 0.880     | —                       |
| yield 1200 + K_PHOTO 0.04 | 5/5      | —          | 395k    | 5,093   | 3.6     | 0.75 → 0.20                      | 0.963     | —                       |
| confine                   | 5/5      | —          | 323     | 351     | ∞       | 0.83 → 0.77                      | 1.068     | 3.01                    |
| confine × any lever above | 5/5      | —          | 350–450 | 390–490 | ∞       | ~0.8 → 0.74–0.81                 | 0.75–1.33 | 3.3–3.5 where on ladder |
| frozen r (control)        | 5/5      | —          | 1,716   | 141     | 0.60    | 1.00                             | 1.044     | 2.77                    |
| worst-case birth gate     | 5/5      | —          | 334     | 79      | 0.35    | 0.97 → 1.18                      | = base    | = base                  |
| worst-case gate + confine | 5/5      | —          | 34      | 61      | ∞       | 0.99 → 0.99                      | = confine | = confine               |

`r_max` "—" means no rung on the 0.5–4 ladder reached the mass gate, or the reading fell off the ladder. "Less maintenance" was run as `EXISTENCE_COST` alone (β = 1 fixes the energy unit, so it is not reachable).

## Reproducing

    ./experiments/v0-1-extinction/extinction-sweep.sh   # 19 variants × 5 seeds + income ladder
    ./experiments/v0-1-extinction/sweep2.sh              # worst-case birth gate
    node experiments/v0-1-extinction/extinction-summary.mjs
    node --import ./scripts/ts-esm-resolver.mjs experiments/v0-1-extinction/sieve.ts   # child/parent radius at birth

Wall-clock: extinct or small runs take seconds to minutes; populations of 3–6k organisms take 1.5–3 hours of CPU per 100k-tick seed.

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

## Gate × levers (#41)

The worst-case gate combined with each metabolic lever (`sweep3.sh`, same five seeds, 100k ticks, unprimed). `n`/`r_max` are the lever rows' (the gate never enters the infertile ladder). Generation rate = births per 100k organism-ticks.

| variant                    | survived | births | peak | mean pop, last 10k | births / 100k / organism | mean r 1k → 50k → 100k | per-seed last-10k r          | tenancy | lifespan ≈ |
| -------------------------- | -------- | ------ | ---- | ------------------ | ------------------------ | ---------------------- | ---------------------------- | ------- | ---------- |
| gate                       | 5/5      | 334    | 79   | 45                 | 6.1                      | 0.97 → 1.10 → 1.18     | 1.02, 1.16, 1.25, 1.19, 1.28 | 0.35    | 17k        |
| gate + K_PHOTO 0.04        | 5/5      | 223    | 73   | 44                 | 4.4                      | 0.95 → 1.18 → 1.23     | 0.98, 1.33, 1.24, 1.30, 1.27 | 0.22    | 23k        |
| gate + K_PHOTO 0.06        | 5/5      | 129    | 71   | 38                 | 2.7                      | 0.93 → 1.19 → 1.33     | 1.37, 1.35, 1.24, 1.34, 1.32 | 0.14    | 37k        |
| gate + yield 1200          | 5/5      | 162    | 78   | 57                 | 2.5                      | 0.96 → 0.99 → 1.04     | 0.92, 0.94, 1.00, 1.16, 1.15 | 0.13    | 45k        |
| gate + yield 1600          | 5/5      | 122    | 78   | 67                 | 1.7                      | 0.94 → 0.97 → 0.98     | 0.83, 0.81, 0.95, 1.15, 1.17 | 0.08    | 74k        |
| gate + yield 1200 + K 0.04 | 5/5      | 118    | 75   | 48                 | 2.0                      | 0.94 → 1.07 → 1.16     | 0.93, 1.26, 1.17, 1.33, 1.09 | 0.10    | 53k        |
| gate + c₀ 4.68             | 5/5      | 223    | 80   | 49                 | 3.9                      | 0.94 → 1.06 → 1.13     | 0.99, 1.14, 1.21, 1.15, 1.15 | 0.22    | 27k        |

Lifespan ≈ organism-ticks / deaths. Wall-clock: the whole sweep (30 runs, 16 in parallel) took 42 s; every run 13–30 s.

- **No metabolic lever thickens the gated world.** Every combination survives 5/5, but the population stays pinned at ~40–80 (peak 71–80, founders 40) and the last-10k mean moves only from 45 to 38–67. Reading: without the sieve the ceiling is the child's mass (`food ≥ ρ·childArea`), and none of these levers touches mass.
- **Every lever _lowers_ births and the generation rate** (6.1 → 1.7–4.4 births per organism per 100k ticks). Cheaper living buys longer lives (lifespan 17k → 27–74k ticks), not more children. Births track deaths almost one for one (gate 334/329, yield 1600 122/95), consistent with a birth waiting for a death to free carbon (not measured directly: the harness does not log carbon stocks).
- **Energy-side levers split on r.** K_PHOTO keeps selection alive and pushes r further towards `r_opt = 1.5` (0.06: 1.33 at 100k, every seed 1.24–1.37) with the fewest organisms; yield does the opposite: the thickest rows (yield 1600: 67 organisms) have r stalled at ~0.98, two seeds at 0.81–0.83. No combination collapses towards r ≈ 0.1–0.2.
- **Thickest with r still rising: `gate + yield 1200` (57, r 0.96 → 1.04, barely) or `gate + c₀ 4.68` (49, r 0.94 → 1.13)**, both marginal gains over plain gate (45, r → 1.18) paid for with half or two-thirds the generation rate. Plain gate remains the best trade-off in this set.
- **A thicker world likely needs a mass-side lever** (more ambient food/carbon, lower ρ, cheaper children), not an energy-side one; the energy levers only buy longevity. Not run here.

## Gate × carbon budget (#41)

The worst-case gate with the carbon budget `K` (`CARBON_BUDGET_BASELINE_ORGANISMS`, committed 1438.9) and the ambient split `AMBIENT_CO2_SHARE` (committed 0.6) moved (`sweep4.sh`, same five seeds, 100k ticks, unprimed). The hypothesis under test: the gated world is thin because it sits at ADR-0022's carbon ceiling, where ambient total carbon `s` has fallen to ρ (with the gate, to `ρ·(1+δ)² = 1.17ρ`). From this sweep on, the trajectory also logs `s/ρ`, ambient food/ρ, mean internal `C_food/ρ` and `α_bright` every 1k ticks; plain `gate` was rerun to get them and reproduces its committed numbers exactly.

Straight `K ×1.5, ×2, ×3` never became a world (below), so `K` was also stepped where it can live: ×1.25 as is, ×1.25 and ×1.4 with ambient CO₂ held at its committed 1.044 and the surplus put into food (`+co2held`), and ×1.5/×2/×3 with `K_CAP_FOOD` and `K_CAP_CARBON_DIOXIDE` scaled by the same factor as `s` (`+caps`: every store-to-cap ratio stays the committed one).

Predictions, written before the runs (ADR-0022, 40 founders of summed area ≈ 125.7):

| variant           | K    | s₀/ρ | ambient food₀/ρ | N_max at s = ρ (r 1.0 / 1.2) | N_max at s = 1.17ρ (r 1.0 / 1.2) |
| ----------------- | ---- | ---- | --------------- | ---------------------------- | -------------------------------- |
| gate              | 1439 | 1.74 | 0.70            | 337 / 234                    | 253 / 176                        |
| share 0.4         | 1439 | 1.74 | 1.04            | 337 / 234                    | 253 / 176                        |
| share 0.2         | 1439 | 1.74 | 1.39            | 337 / 234                    | 253 / 176                        |
| K ×1.25           | 1799 | 2.19 | 0.88            | 517 / 359                    | 419 / 291                        |
| K ×1.25 + co2held | 1799 | 2.19 | 1.14            | 517 / 359                    | 419 / 291                        |
| K ×1.4 + co2held  | 2015 | 2.46 | 1.41            | 625 / 434                    | 519 / 360                        |
| K ×1.5 (+caps)    | 2158 | 2.63 | 1.05            | 697 / 484                    | 585 / 406                        |
| K ×2 (+caps)      | 2878 | 3.53 | 1.41            | 1057 / 734                   | 917 / 637                        |
| K ×3 (+caps)      | 4317 | 5.32 | 2.13            | 1776 / 1234                  | 1581 / 1098                      |

Already before running, the plain gate's own state (45 organisms at r ≈ 1.18) puts `s/ρ` at ≈ 1.66, far above 1.17: the ceiling should not be binding there. If it were, `K` would scale the population with `N_max` and the share would do nothing.

| variant                                         | survived | births | peak  | mean pop, last 10k | N_max at s = ρ, at measured r | births / 100k / organism | mean r 1k → 50k → 100k   | per-seed last-10k r          | tenancy | lifespan ≈ | s/ρ, last 10k | ambient food/ρ 1k → last 10k | α_bright 1k → last 10k |
| ----------------------------------------------- | -------- | ------ | ----- | ------------------ | ----------------------------- | ------------------------ | ------------------------ | ---------------------------- | ------- | ---------- | ------------- | ---------------------------- | ---------------------- |
| gate                                            | 5/5      | 334    | 79    | 45                 | 242                           | 6.1                      | 0.97 → 1.10 → 1.18       | 1.02, 1.16, 1.25, 1.19, 1.28 | 0.35    | 17k        | 1.67          | 0.78 → 0.92                  | 8.8 → 0.7              |
| gate + share 0.4                                | 5/5      | 704    | 109   | 89                 | 381                           | 7.8                      | 0.98 → 0.95 → 0.94       | 0.92, 0.92, 0.93, 0.99, 0.96 | 0.43    | 14k        | 1.61          | 1.00 → 0.87                  | 36 → 6.9               |
| gate + share 0.2                                | 5/5      | 2,579  | 143   | 122                | 435                           | 21.2                     | 0.97 → 0.89 → 0.88       | 0.86, 0.86, 0.90, 0.94, 0.87 | 0.88    | 4.9k       | 1.57          | 1.10 → 0.94                  | 23 → 11                |
| gate + K ×1.25                                  | 5/5      | 22.5k  | 489   | 434                | 1,345                         | 62.9                     | 0.94 → 0.68 → 0.62       | 0.65, 0.60, 0.62, 0.61, 0.64 | 0.92    | 1.6k       | 1.77          | 0.93 → 0.94                  | 15 → 15                |
| gate + K ×1.25 co2held                          | 5/5      | 25.6k  | 482   | 440                | 1,345                         | 65.5                     | 0.90 → 0.67 → 0.62       | 0.63, 0.63, 0.62, 0.64, 0.61 | 0.89    | 1.6k       | 1.76          | 1.01 → 0.93                  | 12 → 15                |
| gate + K ×1.4 co2held                           | 5/5      | 544k   | 2,278 | 2,186              | ~10k (4 seeds at r ≈ 0.25)    | 418                      | 0.92 → 0.47 → 0.33       | 0.24, 0.24, 0.66, 0.25, 0.25 | 2.81    | 0.2k       | 2.04          | 1.07 → 1.06                  | 19 → 25                |
| gate + K ×1.5 + caps                            | 5/5      | 11.9k  | 565   | 489                | 1,239                         | 26.0                     | 0.91 → 0.77 → 0.75       | 0.71, 0.70, 0.81, 0.78, 0.73 | 0.60    | 4.0k       | 1.84          | 0.87 → 0.62                  | 37 → 35                |
| gate + K ×2 + caps                              | stopped  | —      | —     | —                  | 1,057 / 734 at r 1.0 / 1.2    | —                        | probe: 0.80 → 0.73 (25k) | —                            | —       | —          | 2.1 (probe)   | 0.71 → 0.62 (probe)          | 36 → 43 (probe)        |
| gate + K ×3 + caps                              | stopped  | —      | —     | —                  | 1,776 / 1,234 at r 1.0 / 1.2  | —                        | —                        | —                            | —       | —          | —             | —                            | —                      |
| gate + K ×1.5 / ×2 / ×3 (straight, and co2held) | 0/5      | 0      | 40    | —                  | —                             | —                        | all dead by tick 250     | —                            | —       | —          | —             | —                            | —                      |

K ×2 and ×3 + caps were stopped unfinished after 5 h wall-clock, with all 10 seeds still running (K ×1.4's runaway seeds took about 3 h each). No results are kept. A 25k-tick probe of K ×2 + caps (seed 7, 2 min) held about 800 organisms (peak 837) at r 0.80 → 0.73 with `s/ρ` 2.1 and stayed stable to 25k. So the full runs must run away later, like K ×1.4. The same probe for K ×3 had not reached 25k after 45 min, so it runs away earlier.

`N_max at measured r` is ADR-0022's `(K/2 − aquariumArea/2π)/r²` at the row's last-10k mean r. `α_bright` is the per-tick bright-band mean sampled every 1k ticks, with organisms whose respiration was throttled by a full energy store left out (ADR-0015's rule). It is noisy, and dividing by r inflates it at small r.

- **The carbon-ceiling hypothesis does not hold.** No surviving row gets near its ceiling. `s/ρ` settles at 1.57–2.04, never close to 1 or to the gate's 1.17, and every population is 20–40% of ADR-0022's `N_max` at its own r. The plain gate's 45 organisms are not carbon-capped: they leave about 80% of the ceiling unused.
- **Yet carbon is the lever that thickens the world, through its composition.** Lowering the CO₂ share at the committed `K` (same `s`, same `N_max`) doubles and triples the population (45 → 89 → 122) and the generation rate (6.1 → 7.8 → 21.2). Every row where more carbon goes to food thickens, by 2× to 50×. Ambient food/ρ settles around 0.9–1.07 in every committed-cap row whatever it started at (the plain gate's rises 0.78 → 0.92). The population grows until births and deaths hold food there, not until `s` runs down.
- **Thickening costs the selection the gate bought.** Every thickened row loses the rise in r: 0.94 (share 0.4), 0.88 (share 0.2), 0.62 (K ×1.25), 0.75 (K ×1.5 + caps). K ×1.4 runs away at 20–30k in 4 seeds of 5: r falls to ≈ 0.25, about 2,500 organisms, lifespan ≈ 200 ticks, tenancy 2.8. That is the old small-body regime, now with the gate in place. More food makes children cheap, so fast small breeders win. Of the committed levers only the gate's own scarcity drives r towards `r_opt`.
- **`K` has a hard viability wall under the committed caps.** Straight K ×1.5/×2/×3 kill all 40 founders by tick 250 in every seed, and holding CO₂ at 1.044 while putting the surplus in food does the same. The boundary sits where `s₀` passes about `K_CAP_FOOD + K_CAP_CARBON_DIOXIDE = 2.5`. Every row with `s₀` ≤ 2.46 lives, and every row from 2.63 up dies. This is consistent with respiration being throttled by CO₂ headroom (`metabolism.ts`) once photosynthesis fills the food store before it has drawn internal CO₂ under its cap. So `K` cannot move far without the caps moving with it.
- **α moves.** `α_bright` at 1k is 8.8 on the plain gate (the ladder reads 8.3), 12–37 in the richer rows, and it stays high (7–35 in the last 10k against 0.7 for the gate). A richer ambient changes income, so `c₀ = α·r_opt/2` (6.24) would have to be solved again for any `K` or share moved.

## Results

Five seeds (7–11), 100k ticks, unprimed, `n`/`r_max` from the income ladder (infertile fixed population, so the birth gate never enters it). Full table and trajectories: [`results/summary.md`](results/summary.md), raw per-seed JSON in `results/`.

| variant                    | survived | extinct at | births  | peak    | tenancy | mean r 1k → 100k (or last alive) | n         | r_max                   |
| -------------------------- | -------- | ---------- | ------- | ------- | ------- | -------------------------------- | --------- | ----------------------- |
| base                       | 0/5      | 14–23k     | 23.5k   | 1,072   | 3.9     | 0.80 → 0.18                      | 1.044     | 2.77                    |
| c₀ 4.68                    | 0/5      | 27–34k     | 93k     | 2,387   | 6.4     | 0.77 → 0.18                      | 1.158     | 2.90                    |
| c₀ 3.12                    | 2/5      | 71–85k     | 854k    | 6,365   | 9.3     | 0.76 → 0.10                      | 1.340     | 2.98                    |
| yield 1000                 | 0/5      | 24–34k     | 70k     | 2,011   | 6.5     | 0.76 → 0.17                      | 1.107     | 3.15                    |
| yield 1200                 | 0/5      | 36–81k     | 284k    | 3,143   | 7.5     | 0.76 → 0.16                      | 1.208     | —                       |
| yield 1600                 | 5/5      | —          | 118k    | 3,011   | 1.9     | 0.75 → 0.21                      | 0.948     | —                       |
| K_PHOTO 0.04               | 0/5      | 26–41k     | 142k    | 2,446   | 7.5     | 0.76 → 0.16                      | 1.112     | —                       |
| K_PHOTO 0.06               | 5/5      | —          | 2.84M   | 6,007   | 14.4    | 0.77 → 0.12                      | 0.880     | —                       |
| yield 1200 + K_PHOTO 0.04  | 5/5      | —          | 395k    | 5,093   | 3.6     | 0.75 → 0.20                      | 0.963     | —                       |
| confine                    | 5/5      | —          | 323     | 351     | ∞       | 0.83 → 0.77                      | 1.068     | 3.01                    |
| confine × any lever above  | 5/5      | —          | 350–450 | 390–490 | ∞       | ~0.8 → 0.74–0.81                 | 0.75–1.33 | 3.3–3.5 where on ladder |
| frozen r (control)         | 5/5      | —          | 1,716   | 141     | 0.60    | 1.00                             | 1.044     | 2.77                    |
| worst-case birth gate      | 5/5      | —          | 334     | 79      | 0.35    | 0.97 → 1.18                      | = base    | = base                  |
| worst-case gate + confine  | 5/5      | —          | 34      | 61      | ∞       | 0.99 → 0.99                      | = confine | = confine               |
| gate + K_PHOTO 0.04        | 5/5      | —          | 223     | 73      | 0.22    | 0.95 → 1.23                      | 1.112     | —                       |
| gate + K_PHOTO 0.06        | 5/5      | —          | 129     | 71      | 0.14    | 0.93 → 1.33                      | 0.880     | —                       |
| gate + yield 1200          | 5/5      | —          | 162     | 78      | 0.13    | 0.96 → 1.04                      | 1.208     | —                       |
| gate + yield 1600          | 5/5      | —          | 122     | 78      | 0.08    | 0.94 → 0.98                      | 0.948     | —                       |
| gate + yield 1200 + K 0.04 | 5/5      | —          | 118     | 75      | 0.10    | 0.94 → 1.16                      | 0.963     | —                       |
| gate + c₀ 4.68             | 5/5      | —          | 223     | 80      | 0.22    | 0.94 → 1.13                      | 1.158     | 2.90                    |
| gate + CO₂ share 0.4       | 5/5      | —          | 704     | 109     | 0.43    | 0.98 → 0.94                      | —         | —                       |
| gate + CO₂ share 0.2       | 5/5      | —          | 2,579   | 143     | 0.88    | 0.97 → 0.88                      | —         | —                       |
| gate + K ×1.25             | 5/5      | —          | 22.5k   | 489     | 0.92    | 0.94 → 0.62                      | —         | —                       |
| gate + K ×1.25 co2held     | 5/5      | —          | 25.6k   | 482     | 0.89    | 0.90 → 0.62                      | —         | —                       |
| gate + K ×1.4 co2held      | 5/5      | —          | 544k    | 2,278   | 2.81    | 0.92 → 0.33                      | —         | —                       |
| gate + K ×1.5 + caps       | 5/5      | —          | 11.9k   | 565     | 0.60    | 0.91 → 0.75                      | —         | —                       |
| gate + K ×2 / ×3 + caps    | stopped  | —          | —       | —       | —       | —                                | —         | —                       |
| gate + K ×1.5/×2/×3        | 0/5      | < 250      | 0       | 40      | —       | —                                | —         | —                       |

`r_max` "—" means no rung on the 0.5–4 ladder reached the mass gate, or the reading fell off the ladder. "Less maintenance" was run as `EXISTENCE_COST` alone (β = 1 fixes the energy unit, so it is not reachable).

## Reproducing

    ./experiments/v0-1-extinction/extinction-sweep.sh   # 19 variants × 5 seeds + income ladder
    ./experiments/v0-1-extinction/sweep2.sh              # worst-case birth gate
    ./experiments/v0-1-extinction/sweep3.sh              # worst-case gate × metabolic levers (#41), ~1 min
    ./experiments/v0-1-extinction/sweep4.sh              # worst-case gate × carbon budget K and CO₂ share (#41), hours: K ×1.4 co2held and K ×2/×3 + caps run thousands of organisms
    node experiments/v0-1-extinction/extinction-summary.mjs
    node --import ./scripts/ts-esm-resolver.mjs experiments/v0-1-extinction/sieve.ts   # child/parent radius at birth

Wall-clock: extinct or small runs take seconds to minutes; populations of 3–6k organisms take 1.5–3 hours of CPU per 100k-tick seed.

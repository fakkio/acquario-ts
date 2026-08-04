# Flat existence cost, and calibration by non-dimensionalisation

Energy cost per unit time is `c₀ + β·area`: a flat, size-independent existence cost plus an area-scaled body cost. Constants are calibrated by fixing `kCap = 1`, `β = 1`, `ρ = 1` and the length unit to the baseline radius, choosing the target `r_opt`, and deriving `c₀` from it.

## Why

With every cost scaling as area — the earlier draft, where "existing" and "the body" were never distinguished — `bodyRadius` has **no optimum and collapses to zero**. Income scales with perimeter, so it is linear in `r`; a child costs in proportion to area; therefore reproductive rate `∝ (α·r − β·r²)/r² = α/r − β`, which is monotonically decreasing. Smaller is always fitter, without bound. Left alone, v0.1 would drive the radius to its numerical floor and stop, which would *look* like evolution finding an optimum.

Adding the flat term restores an interior optimum, because `c₀/r²` diverges as `r → 0`:

```text
reproductiveRate(r) ∝ α/r − c₀/r² − β        r_opt = 2·c₀/α
```

Storage capacity does not substitute for this. Autonomy is `capacity ÷ burn rate = kCap·πr² / (c₀ + β·πr²)`, which with `c₀ = 0` reduces to the constant `kCap/β` — a large organism stores four times as much and burns it four times as fast, so size confers no buffering advantage at all. The storage advantage is *created* by `c₀`, not independent of it.

## Consequences

- `c₀` is the most important constant in v0.1: it alone sets body size. Calibration becomes solving `c₀ = α·r_opt/2` rather than trial and error.
- It supplies the closed-form prediction that the v0.1 done-criterion tests against (ADR-0011). Without it there is no way to distinguish selection from drift into a floor.
- The same shape generalises to v0.2: a flat overhead plus an area-scaled cost per organelle, with sublinear effectiveness, is what makes "few large versus many small organelles" a real trade-off rather than a stated aspiration.
- It is a floor, not a ceiling: large bodies remain free to evolve in v0.2 once organelles give them something worth carrying.
- Initial pools are expressed as a carbon budget — "enough carbon for K baseline organisms" — so the tuned number is ecological rather than abstract.
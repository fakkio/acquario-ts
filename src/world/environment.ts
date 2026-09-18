import {AQUARIUM_AREA} from "./aquarium";
import type {Pools} from "./ledger";
import {lightAt} from "./light";
import {DIFFUSIBLES, type Diffusible} from "./organism";

/**
 * The `Environment` seam (ADR-0005): everything metabolic code touches, and
 * the only thing it touches. Every method takes a position, even though the
 * v0.1 implementation reads it only in `light` — every other pool is global
 * and well-mixed, so the day a spatial fluid field replaces them in v0.2,
 * no metabolic call site changes: only what sits behind this seam does.
 */

/** A point in the aquarium's plane, in baseline body radii. */
export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

/**
 * The narrow handle an organism gets. No method here can commit or mutate a
 * pool — `exchange` only ever answers with a number — the same structural
 * guarantee that keeps the render layer from moving a body: an interface
 * with no mutating method cannot be used to mutate anything.
 */
export interface Environment {
  concentration(resource: Diffusible, pos: Vec2): number;
  light(pos: Vec2): number;
  /**
   * Requests `amount` of `resource` — positive draws from the pool,
   * negative vents into it — and answers with the amount actually granted.
   * What "actually granted" means depends on which sub-pass built this
   * `Environment` (ADR-0016): the request pass always answers 0, having
   * only recorded the ask; the grant pass answers the settled amount, which
   * is exactly what the caller ends the tick holding.
   */
  exchange(resource: Diffusible, pos: Vec2, amount: number): number;
}

function emptyPerDiffusible(): Record<Diffusible, number[]> {
  return {oxygen: [], carbonDioxide: [], food: []};
}

/**
 * Sums `values` in ascending order rather than in whatever order they were
 * collected. Floating-point addition is not associative, so summing the
 * same *values* in a different order can move the last bit — sorting first
 * makes the sum a function of the multiset of values alone, never of which
 * order they arrived in. That is what lets reordering the population leave
 * `ExchangeSettlement`'s totals, and so every organism's grant and every
 * pool level, bit-identical: the set of amounts requested by a population
 * does not change when the population is only reordered, and this is the
 * one place that set turns into a single number.
 *
 * Exported for `death.ts`'s deposit, which needs the same guarantee for the
 * same reason (ADR-0017): summed in population order, it would break
 * ADR-0005's reorder guarantee the day two organisms die on one tick.
 */
export function sumAscending(values: readonly number[]): number {
  return [...values]
    .sort((a, b) => a - b)
    .reduce((sum, value) => sum + value, 0);
}

/**
 * The tick's wider handle onto the pools (ADR-0016) — everything metabolic
 * code cannot reach. Built once per tick from that tick's `Pools`, which is
 * already an immutable record: holding a reference to it *is* the
 * snapshot, with no separate copy to keep in sync. Consumed across both
 * exchange sub-passes and dropped once `commit` hands back the pools the
 * tick's delta buffer produced, exactly as the uniform grid is built,
 * consumed and dropped within a single tick.
 *
 * The two `Environment`s this hands out (`requestPass`, `grantPass`) are
 * deliberately the *same interface* wearing two behaviours: metabolic code
 * that calls `exchange` does not know or care which sub-pass it is in, so
 * `applyPassiveExchange` runs unchanged in both.
 */
export class ExchangeSettlement {
  // Every draw requested this tick, per resource, in whatever order
  // `requestPass` was called in — order that `settle` deliberately
  // discards. See `sumAscending`.
  private readonly requested = emptyPerDiffusible();
  private readonly scale: Record<Diffusible, number> = {
    oxygen: 1,
    carbonDioxide: 1,
    food: 1,
  };
  // The delta buffer (CONTEXT.md): every grant made this tick, signed the
  // same way `exchange`'s `amount` is — positive drawn from the pool,
  // negative vented into it — applied to the pools exactly once, in
  // `commit`.
  private readonly granted = emptyPerDiffusible();

  constructor(private readonly pools: Pools) {}

  /** What `requestPass` and `grantPass` share: reading a pool's
   * concentration and the light at a depth are the same lookup regardless
   * of which sub-pass is asking. Only `exchange` differs between them. */
  private readEnvironment() {
    return {
      concentration: (resource: Diffusible) =>
        this.pools[resource] / AQUARIUM_AREA,
      light: (pos: Vec2) => lightAt(pos.y),
    };
  }

  /**
   * Sub-pass 2a. `exchange` writes only to this settlement's request
   * ledger — never to an organism, never to a pool — and always answers 0.
   * `applyPassiveExchange` unconditionally adds that answer to the
   * organism's own store, so this sub-pass ends up writing nothing,
   * exactly as ADR-0016 requires, without needing a special case for it.
   */
  requestPass(): Environment {
    return {
      ...this.readEnvironment(),
      exchange: (resource, _pos, amount) => {
        if (amount > 0) {
          this.requested[resource].push(amount);
        }
        return 0;
      },
    };
  }

  /**
   * Computed once, between the two sub-passes, from *total* demand — the
   * reason a single pass cannot answer `exchange` correctly (ADR-0016's
   * worked example). A resource nobody drew past its pool scales at 1: no
   * demand, or demand the pool can cover in full.
   */
  settle(): void {
    for (const resource of DIFFUSIBLES) {
      const pool = this.pools[resource];
      const demand = sumAscending(this.requested[resource]);
      this.scale[resource] = demand > pool ? pool / demand : 1;
    }
  }

  /**
   * Sub-pass 2b. `exchange` answers with the amount actually granted: a
   * draw (positive `amount`) scaled by `settle`'s factor for that
   * resource, a vent (zero or negative) passed through unscaled, because a
   * vent only ever makes a pool larger and so always fits. Every answer is
   * also folded into the delta buffer, so what an organism ends the tick
   * holding and what leaves the pool are read from the one number.
   */
  grantPass(): Environment {
    return {
      ...this.readEnvironment(),
      exchange: (resource, _pos, amount) => {
        const grant = amount > 0 ? amount * this.scale[resource] : amount;
        this.granted[resource].push(grant);
        return grant;
      },
    };
  }

  /**
   * The tick's single well-defined mutation of the pools (ADR-0006's step
   * 9): every grant decided in `grantPass`, applied at once. A pool never
   * goes negative, because `settle` scaled every draw against that same
   * pool's own total demand before any of them was granted.
   */
  commit(): Pools {
    return {
      oxygen: this.pools.oxygen - sumAscending(this.granted.oxygen),
      carbonDioxide:
        this.pools.carbonDioxide - sumAscending(this.granted.carbonDioxide),
      food: this.pools.food - sumAscending(this.granted.food),
    };
  }
}

import {AQUARIUM_AREA} from "./aquarium";
import type {Pools} from "./ledger";
import {lightAt} from "./light";
import type {Diffusible} from "./organism";

/**
 * The `Environment` seam (ADR-0005): everything metabolic code touches, and
 * the only thing it touches. A point in the aquarium's plane, in baseline
 * body radii — every `Environment` method takes one, even though the v0.1
 * implementation reads it only in `light`. Every other pool is global and
 * well-mixed, so the day a spatial fluid field replaces them in v0.2, no
 * metabolic call site changes: only what sits behind this seam does.
 */
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

const DIFFUSIBLES: readonly Diffusible[] = ["oxygen", "carbonDioxide", "food"];

function zeroPerDiffusible(): Record<Diffusible, number> {
  return {oxygen: 0, carbonDioxide: 0, food: 0};
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
  private readonly demand = zeroPerDiffusible();
  private readonly scale: Record<Diffusible, number> = {
    oxygen: 1,
    carbonDioxide: 1,
    food: 1,
  };
  // The delta buffer (CONTEXT.md): accumulated grants, signed the same way
  // `exchange`'s `amount` is — positive drawn from the pool, negative
  // vented into it — applied to the pools exactly once, in `commit`.
  private readonly granted = zeroPerDiffusible();

  constructor(private readonly pools: Pools) {}

  /**
   * Sub-pass 2a. `exchange` writes only to this settlement's demand tally
   * — never to an organism, never to a pool — and always answers 0.
   * `applyPassiveExchange` unconditionally adds that answer to the
   * organism's own store, so this sub-pass ends up writing nothing,
   * exactly as ADR-0016 requires, without needing a special case for it.
   */
  requestPass(): Environment {
    return {
      concentration: (resource) => this.pools[resource] / AQUARIUM_AREA,
      light: (pos) => lightAt(pos.y),
      exchange: (resource, _pos, amount) => {
        if (amount > 0) {
          this.demand[resource] += amount;
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
      const demand = this.demand[resource];
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
      concentration: (resource) => this.pools[resource] / AQUARIUM_AREA,
      light: (pos) => lightAt(pos.y),
      exchange: (resource, _pos, amount) => {
        const grant = amount > 0 ? amount * this.scale[resource] : amount;
        this.granted[resource] += grant;
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
      oxygen: this.pools.oxygen - this.granted.oxygen,
      carbonDioxide: this.pools.carbonDioxide - this.granted.carbonDioxide,
      food: this.pools.food - this.granted.food,
    };
  }
}

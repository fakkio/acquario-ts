import {describe, expect, it} from "vitest";

import {
  AQUARIUM_HEIGHT,
  AQUARIUM_WIDTH,
  BASELINE_BODY_RADIUS,
} from "./aquarium";
import {CARBON_BUDGET_BASELINE_ORGANISMS, R_NEW} from "./constants";
import {applyMotion, constrainToAquarium} from "./motion";
import {ORGANELLE_TYPES, type OrganelleType} from "./organelles";
import type {Organism} from "./organism";
import {createRngStream, drawUnitVector} from "./rng";
import {bearerAt, carrierAt, organismAt, shuffle} from "./testing";

interface Point {
  readonly x: number;
  readonly y: number;
}

const CENTRE_X = AQUARIUM_WIDTH / 2;
const CENTRE_Y = AQUARIUM_HEIGHT / 2;

/**
 * The step a baseline body takes each tick, pinned rather than recomputed from
 * the constants: a test that restates `force / (drag · radius)` passes just as
 * happily when that formula is wrong. This number is also the calibration the
 * force was tuned to produce, so retuning fails here and has to be re-judged
 * against how the run looks, which is the only place that call can be made.
 */
const BASELINE_STEP = 0.1061032953945969;

const positionOf = (point: Point): Point => ({x: point.x, y: point.y});

const distance = (a: Point, b: Point): number =>
  Math.hypot(a.x - b.x, a.y - b.y);

const moveFor = (organism: Organism, ticks: number): void => {
  for (let i = 0; i < ticks; i++) {
    applyMotion(organism);
  }
};

/** Everything a tick is allowed to write to an organism. */
const mutableStateOf = (organism: Organism) => ({
  x: organism.x,
  y: organism.y,
  rng: organism.rng,
});

const expectWhollyInsideAquarium = (organism: Organism): void => {
  expect(organism.x - organism.bodyRadius).toBeGreaterThanOrEqual(0);
  expect(organism.y - organism.bodyRadius).toBeGreaterThanOrEqual(0);
  expect(organism.x + organism.bodyRadius).toBeLessThanOrEqual(AQUARIUM_WIDTH);
  expect(organism.y + organism.bodyRadius).toBeLessThanOrEqual(AQUARIUM_HEIGHT);
};

describe("applyMotion", () => {
  it("moves the organism off the spot it started on", () => {
    const organism = organismAt(CENTRE_X, CENTRE_Y);
    const start = positionOf(organism);

    applyMotion(organism);

    expect(distance(organism, start)).toBeGreaterThan(0);
  });

  it("moves a baseline body about a tenth of its radius per tick", () => {
    const organism = organismAt(CENTRE_X, CENTRE_Y);
    const start = positionOf(organism);

    applyMotion(organism);

    expect(distance(organism, start)).toBeCloseTo(BASELINE_STEP, 12);
  });

  // The overdamped clause of ADR-0008, in the form that can actually fail:
  // velocity is a function of the current force and the body's radius alone.
  // A momentum term, however small, would make some step longer than another.
  it("moves the same distance every tick, with no memory of the tick before", () => {
    const organism = organismAt(CENTRE_X, CENTRE_Y);

    for (let i = 0; i < 50; i++) {
      const before = positionOf(organism);
      applyMotion(organism);

      expect(distance(organism, before)).toBeCloseTo(BASELINE_STEP, 12);
    }
  });

  // Stokes–Einstein: the diffusion coefficient goes as 1/r. A random walk's
  // coefficient goes as the square of its step, so the step itself must go as
  // 1/√r, not as 1/r.
  it("moves a large body less far than a small one, in inverse proportion to the square root of radius", () => {
    const small = organismAt(CENTRE_X, CENTRE_Y, 0.6);
    const large = organismAt(CENTRE_X, CENTRE_Y, 1.4);
    const startSmall = positionOf(small);
    const startLarge = positionOf(large);

    applyMotion(small);
    applyMotion(large);

    expect(
      distance(large, startLarge) / distance(small, startSmall),
    ).toBeCloseTo(Math.sqrt(0.6 / 1.4), 12);
  });

  it("advances the organism's own stream, so the next tick draws a new direction", () => {
    const organism = organismAt(CENTRE_X, CENTRE_Y);
    const before = organism.rng.state;

    applyMotion(organism);

    expect(organism.rng.state).not.toBe(before);
  });

  // Resolve phase, step 6: an organism's motion touches that organism and
  // nothing else. This is the restriction that makes the whole phase
  // order-independent by construction, so it is worth asserting directly
  // rather than inferring it from the permutation test below.
  it("leaves every other organism in the population untouched", () => {
    const moving = organismAt(CENTRE_X, CENTRE_Y, BASELINE_BODY_RADIUS, 1);
    const bystander = organismAt(10, 10, 0.8, 2);
    const before = mutableStateOf(bystander);

    moveFor(moving, 20);

    expect(mutableStateOf(bystander)).toEqual(before);
  });

  // Not a heading: a body that kept the same direction would end up a full
  // path length from where it started.
  it("leaves net displacement far below the path the body travelled", () => {
    const organism = organismAt(CENTRE_X, CENTRE_Y);
    const start = positionOf(organism);
    const ticks = 1000;

    moveFor(organism, ticks);

    expect(distance(organism, start)).toBeLessThan(
      (ticks * BASELINE_STEP) / 10,
    );
  });

  // ADR-0007's guarantee, first testable here: an organism draws from its own
  // stream and from nothing else, so where it sits in the population array —
  // and how many draws every other organism made first — cannot reach it.
  it("gives an organism the same trajectory whatever order the population is stepped in", () => {
    const buildPopulation = () =>
      [1, 2, 3, 4, 5, 6, 7, 8].map((seed) =>
        organismAt(CENTRE_X, CENTRE_Y, 0.6 + seed * 0.1, seed),
      );

    const inOrder = buildPopulation();
    // The same organisms as `twins`, held in a different order — so comparing
    // `twins` against `inOrder` afterwards pairs each body with its own twin
    // regardless of where the shuffle moved it.
    const twins = buildPopulation();
    const shuffled = shuffle([...twins], createRngStream(4242));

    // Both loops mirror the tick: motion in the resolve phase for every
    // organism, then the wall constraint in the commit phase for every one.
    for (let tick = 0; tick < 50; tick++) {
      for (const population of [inOrder, shuffled]) {
        for (const organism of population) {
          applyMotion(organism);
        }
        for (const organism of population) {
          constrainToAquarium(organism);
        }
      }
    }

    expect(shuffled).not.toEqual(twins);
    expect(inOrder).toEqual(twins);
  });

  // The observable consequence of Stokes drag: the diffusion coefficient goes
  // as 1/r, so a population of large bodies stays nearer where it was placed
  // than a population of small ones. Separate seeds for the two groups, so the
  // comparison is between two independent ensembles rather than between one
  // trajectory and a rescaling of itself.
  it("leaves large bodies nearer their start than small ones, across a population", () => {
    const SAMPLES = 40;
    const TICKS = 800;

    const meanDisplacement = (bodyRadius: number, firstSeed: number) => {
      let total = 0;
      for (let i = 0; i < SAMPLES; i++) {
        const organism = organismAt(
          CENTRE_X,
          CENTRE_Y,
          bodyRadius,
          firstSeed + i,
        );
        const start = positionOf(organism);
        moveFor(organism, TICKS);
        total += distance(organism, start);
      }
      return total / SAMPLES;
    };

    const small = meanDisplacement(0.6, 1000);
    const large = meanDisplacement(1.4, 5000);

    expect(large).toBeLessThan(small);
    // Around the √(0.6/1.4) ≈ 0.65 the step lengths differ by; loose enough
    // that the ensemble noise of forty bodies (about ±0.075) cannot flip it.
    expect(large / small).toBeGreaterThan(0.45);
    expect(large / small).toBeLessThan(0.9);
  });
});

describe("constrainToAquarium", () => {
  it("leaves a body that is already clear of every wall exactly where it is", () => {
    const organism = organismAt(CENTRE_X, CENTRE_Y);
    const before = positionOf(organism);

    constrainToAquarium(organism);

    expect(positionOf(organism)).toEqual(before);
  });

  it.each([
    ["the left wall", {x: -5, y: CENTRE_Y}],
    ["the top wall", {x: CENTRE_X, y: -5}],
    ["the right wall", {x: AQUARIUM_WIDTH + 5, y: CENTRE_Y}],
    ["the bottom wall", {x: CENTRE_X, y: AQUARIUM_HEIGHT + 5}],
  ])(
    "pulls a body that crossed %s back inside, whole body and all",
    (_wall, position) => {
      const organism = organismAt(position.x, position.y);

      constrainToAquarium(organism);

      expectWhollyInsideAquarium(organism);
    },
  );

  // Hard walls, not bouncy ones: the body ends up touching the wall it was
  // pushed into, rather than being reflected back off it.
  it("rests a body against the wall it was pushed into", () => {
    const organism = organismAt(-5, CENTRE_Y);

    constrainToAquarium(organism);

    expect(organism.x).toBe(organism.bodyRadius);
    expect(organism.y).toBe(CENTRE_Y);
  });

  it("holds a body resting against a wall still, tick after tick", () => {
    const organism = organismAt(-5, CENTRE_Y);
    constrainToAquarium(organism);
    const resting = positionOf(organism);

    constrainToAquarium(organism);

    expect(positionOf(organism)).toEqual(resting);
  });

  it("keeps a body under brownian motion inside the walls, every tick of it", () => {
    const organism = organismAt(BASELINE_BODY_RADIUS, BASELINE_BODY_RADIUS);

    for (let tick = 0; tick < 5000; tick++) {
      applyMotion(organism);
      constrainToAquarium(organism);

      expectWhollyInsideAquarium(organism);
    }
  });

  // The largest body that can be wholly inside the aquarium at all: the
  // tighter of two ceilings. `r = √K` (ADR-0012's amendment) is the carbon
  // ledger's own bound — a single body cannot exceed the whole carbon
  // budget — but #35 raised `K` past the point where that bound is the
  // binding one. `clamp`'s `min` is `bodyRadius` and its `max` is
  // `AQUARIUM_HEIGHT − bodyRadius`; the two cross once `bodyRadius` passes
  // `AQUARIUM_HEIGHT / 2 = 20`, and a circle wider than the aquarium's
  // shorter side cannot be wholly contained regardless of clamping, so
  // `min(AQUARIUM_WIDTH, AQUARIUM_HEIGHT) / 2` is the geometry's own
  // ceiling on top of the ledger's.
  it("still holds a body against the wall at the largest radius that can fit it", () => {
    const largestPermittedRadius = Math.min(
      Math.sqrt(CARBON_BUDGET_BASELINE_ORGANISMS),
      Math.min(AQUARIUM_WIDTH, AQUARIUM_HEIGHT) / 2,
    );
    const organism = organismAt(-5, CENTRE_Y, largestPermittedRadius);

    constrainToAquarium(organism);

    expectWhollyInsideAquarium(organism);
    expect(organism.x).toBe(organism.bodyRadius);
  });
});

describe("applyMotion under gravity", () => {
  const FLOAT_RADIUS = R_NEW;
  const FLOAT = {
    type: "float" as const,
    radius: FLOAT_RADIUS,
    x: 0,
    y: 0,
  };
  const withoutBrownian = {brownian: "off"} as const;

  /**
   * The closed-form speed of a baseline body carrying one float at `r_new`
   * with the surface's water around it: `g·r_new²/(6R)`, pinned. The lift
   * is `g·π·r_new²` and the drag `6π·R` with `R = √(1 + r_new²)`. Restating
   * the formula would pass just as happily with a wrong `g`.
   */
  const SURFACE_RISE = 0.0002813914596745962;

  it("steps a body with no organelles exactly the Brownian step at any depth", () => {
    for (const depth of [1, CENTRE_Y, AQUARIUM_HEIGHT - 1]) {
      const organism = organismAt(CENTRE_X, depth);
      const start = positionOf(organism);

      applyMotion(organism);

      expect(distance(organism, start)).toBeCloseTo(BASELINE_STEP, 12);
    }
  });

  it("steps a body carrying only neurons exactly the step it would take bare", () => {
    for (const depth of [1, CENTRE_Y, AQUARIUM_HEIGHT - 1]) {
      const bare = carrierAt(CENTRE_X, depth, []);
      const carrier = carrierAt(CENTRE_X, depth, [0.2, 0.3]);
      const start = positionOf(carrier);

      applyMotion(carrier);

      expect(distance(carrier, start)).toBeCloseTo(
        BASELINE_STEP / Math.sqrt(carrier.bodyRadius / bare.bodyRadius),
        12,
      );
    }
  });

  it("draws exactly once, first, and not at all with Brownian motion off", () => {
    const carrier = bearerAt(CENTRE_X, CENTRE_Y, [FLOAT]);
    const before = carrier.rng;

    applyMotion(carrier, withoutBrownian);
    expect(carrier.rng).toBe(before);

    applyMotion(carrier);
    expect(carrier.rng).toEqual(drawUnitVector(before).stream);
  });

  it("raises a float carrier at the closed-form speed near the surface", () => {
    const carrier = bearerAt(CENTRE_X, 0, [FLOAT]);

    applyMotion(carrier, withoutBrownian);

    expect(carrier.x).toBe(CENTRE_X);
    expect(-carrier.y).toBeCloseTo(SURFACE_RISE, 12);
  });

  it("raises it twice as fast near the floor", () => {
    const carrier = bearerAt(CENTRE_X, AQUARIUM_HEIGHT, [FLOAT]);

    applyMotion(carrier, withoutBrownian);

    expect(AQUARIUM_HEIGHT - carrier.y).toBeCloseTo(2 * SURFACE_RISE, 12);
  });

  describe("settling", () => {
    const HEAVY_DENSITY = 1.5;
    const declarations = {
      ...ORGANELLE_TYPES,
      heavy: {...ORGANELLE_TYPES.float, density: HEAVY_DENSITY},
    };
    const heavy = (x: number) => ({
      type: "heavy" as unknown as OrganelleType,
      radius: 0.3,
      x,
      y: 0,
    });
    const floating = (x: number) => ({...FLOAT, radius: 0.3, x});

    const settle = (carrier: Organism): void => {
      for (let tick = 0; tick < 20_000; tick++) {
        applyMotion(carrier, withoutBrownian);
        constrainToAquarium(carrier);
      }
    };

    it.each([5, 35])(
      "settles a float and a heavy fixture at y*/H = M/A from y = %d",
      (start) => {
        // Equal areas side by side: M/A = (−1 + 3/2) / 2 = 1/4.
        const carrier = bearerAt(
          CENTRE_X,
          start,
          [floating(-0.3), heavy(0.3)],
          declarations,
        );

        settle(carrier);

        expect(carrier.y / AQUARIUM_HEIGHT).toBeCloseTo(0.25, 3);
      },
    );

    it("ends against the surface when the composition is lighter than all the water", () => {
      const carrier = bearerAt(CENTRE_X, CENTRE_Y, [floating(0)]);

      settle(carrier);

      expect(carrier.y).toBe(carrier.bodyRadius);
    });

    it("ends against the floor when it is heavier than all of it", () => {
      const carrier = bearerAt(CENTRE_X, CENTRE_Y, [heavy(0)], declarations);

      settle(carrier);

      expect(carrier.y).toBe(AQUARIUM_HEIGHT - carrier.bodyRadius);
    });
  });

  describe("the Body Axis", () => {
    const angleOf = (organism: Organism): number =>
      Math.atan2(organism.axis.sin, organism.axis.cos);

    /** A float below the centre of a body (y runs down), the body tipped
     * a little off the vertical so that it is not at the unstable
     * balance: the weight is off-centre, so the body must turn. */
    const lopsided = (scale = 1): Organism => {
      const carrier = bearerAt(
        CENTRE_X,
        CENTRE_Y,
        [{...FLOAT, radius: 0.3 * scale, y: 0.5 * scale}],
        undefined,
        BASELINE_BODY_RADIUS * scale,
      );
      carrier.axis.cos = Math.cos(0.5);
      carrier.axis.sin = Math.sin(0.5);
      return carrier;
    };

    /** Where the float stands relative to the centre, in the world. */
    const floatOffset = (organism: Organism) => {
      const {x, y} = organism.organelles[0];
      return {
        x: organism.axis.cos * x - organism.axis.sin * y,
        y: organism.axis.sin * x + organism.axis.cos * y,
      };
    };

    const turnUntilStill = (organism: Organism, limit = 200_000): number => {
      for (let tick = 1; tick <= limit; tick++) {
        const before = angleOf(organism);
        applyMotion(organism, withoutBrownian);
        if (Math.abs(angleOf(organism) - before) < 1e-12) {
          return tick;
        }
      }
      return limit;
    };

    it("turns a body with its float below the centre until the float stands directly above it", () => {
      const carrier = lopsided();

      turnUntilStill(carrier);

      const offset = floatOffset(carrier);
      expect(offset.x).toBeCloseTo(0, 6);
      expect(offset.y).toBeLessThan(0);
    });

    it("does not turn a body whose weight sits on its centre", () => {
      const carrier = bearerAt(CENTRE_X, CENTRE_Y, [FLOAT]);

      for (let tick = 0; tick < 1000; tick++) {
        applyMotion(carrier, withoutBrownian);
      }

      expect(carrier.axis).toEqual({cos: 1, sin: 0});
    });

    it("never turns a body with no weighing organelles", () => {
      const bare = organismAt(CENTRE_X, CENTRE_Y);
      const neurons = carrierAt(CENTRE_X, CENTRE_Y, [0.3, 0.2]);

      moveFor(bare, 500);
      moveFor(neurons, 500);

      expect(bare.axis).toEqual({cos: 1, sin: 0});
      expect(neurons.axis).toEqual({cos: 1, sin: 0});
    });

    /** Ticks until the float has swung through a right angle. */
    const ticksToQuarterTurn = (organism: Organism): number => {
      let tick = 0;
      while (angleOf(organism) < Math.PI / 2 && tick < 200_000) {
        applyMotion(organism, withoutBrownian);
        tick++;
      }
      return tick;
    };

    it("rights a scaled copy of a body in the same number of ticks", () => {
      // Lengths times k: the torque goes as k³ (area times arm) and so does
      // the rotational drag, so the angular speed does not change.
      const unit = ticksToQuarterTurn(lopsided());
      const doubled = ticksToQuarterTurn(lopsided(2));

      expect(unit).toBeGreaterThan(10);
      expect(unit).toBeLessThan(200_000);
      // The depth term of the arm is not scale-free, so allow a tick or two.
      expect(Math.abs(doubled - unit)).toBeLessThanOrEqual(2);
    });

    it("keeps the axis a unit vector to rounding over a long run", () => {
      const carrier = lopsided();

      for (let tick = 0; tick < 200_000; tick++) {
        applyMotion(carrier);
        constrainToAquarium(carrier);
      }

      expect(Math.hypot(carrier.axis.cos, carrier.axis.sin)).toBeCloseTo(1, 12);
    });
  });
});
